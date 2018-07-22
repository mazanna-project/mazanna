const Promise = require('bluebird');
const dateFormat = require('dateformat');

const digitalOcean = require('./dgitial_ocean');
const cloudflare = require('./cloudflare');
const logger = require('./logger')

const AvailabilityChecker = require('./availablity_checker');

class HistoryItem {
    constructor(oldIp, newIp) {
        this.oldIp = oldIp;
        this.newIp = newIp;
        this.timestamp = new Date()
    }

    get formattedTimestamp() {
        return dateFormat(this.timestamp, "yyyy-mm-dd h:MM:ss");
    }
}

class ServerFailureHandler {
    constructor(doDropletName, cfZoneName, cfDomain, watchDogTimerTimeout, reqTimeout, checkUrl) {
        this.dropletName = doDropletName;
        this.zoneName = cfZoneName;
        this.domain = cfDomain;
        this.reqTimeout = reqTimeout;
        this.watchDogTimerTimeout = watchDogTimerTimeout;
        this.checkUrl = checkUrl;

        this.history = [];

        this._initWatchDogTimer();

        this.isIpChangeInProgress = false;
    }

    _initWatchDogTimer() {
        logger.info('watchdog timer started.');

        let self = this;
        setTimeout(() => self._onTimerTriggered(), this.watchDogTimerTimeout)
    }

    _onTimerTriggered() {
        logger.info('watchdog timer triggered...');

        let self = this;
        AvailabilityChecker.failIfNotAvailable(this.checkUrl, this.reqTimeout)
            .then(res => {
                logger.info(`server is available! checked via requesting ${this.checkUrl}`);
                self._resetTimer();
            })
            .catch(err => {
                logger.error(`cannot reach to server!!! checked via requesting ${this.checkUrl}`);
                logger.error(err);
                logger.info('initiating ip change process...');

                self.changeServerIp()
                    .then(_ => self._resetTimer())
                    .catch(_ => self._resetTimer())
            });
    }

    _resetTimer() {
        logger.info('timer reset.');

        let self = this;
        setTimeout(() => self._onTimerTriggered(), this.watchDogTimerTimeout);
    }

    changeServerIp() {
        if (this.isIpChangeInProgress) {
            logger.info('one ip change is in progress, skipping...');
            return Promise.reject('one ip change is in progress');
        }

        this.isIpChangeInProgress = true;

        logger.info('ip change is in progress...');

        let self = this;
        return new Promise((resolve, reject) => {
            digitalOcean.assignNewIp(this.dropletName)
                .then(res => {
                    this.history.push(new HistoryItem(res.oldIp, res.newIp));

                    logger.info('floating ip changed successfully!');
                    logger.info(`old_ip: ${res.oldIp}    new_ip: ${res.newIp}`);
                    logger.info(`changing "${self.domain}" destination ip to ${res.newIp} ...`);

                    return cloudflare.applyNewIpToDomain(res.newIp, self.domain, self.zoneName);
                })
                .then(res => {
                    logger.info(`"${self.domain}" destination ip changed successfully!`);

                    self.isIpChangeInProgress = false;
                    resolve();
                })
                .catch(err => {
                    logger.error('unable to change server ip!');
                    logger.error(err);

                    self.isIpChangeInProgress = false;
                    resolve();
                })
        })
    }
}

module.exports = {
    ServerFailureHandler: ServerFailureHandler,
    HistoryItem: HistoryItem
};