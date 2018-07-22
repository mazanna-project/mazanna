const DigitalOcean = require('do-wrapper').default;
const Promise = require('bluebird');

const logger = require('./logger');

let api = new DigitalOcean(process.env.DO_ACCESS_TOKEN, 100);

const RESULT_CHECK_DELAY = 100;

class NoFloatingIpFoundError extends Error {
    constructor(msg) {
        super(msg);
    }
}

class NoDropletFoundError extends Error {
    constructor(msg) {
        super(msg);
    }
}

function waitUntilSuccessful(ip, actionId) {
    return new Promise((resolve, reject) => {
        function checkIsSuccessful(ip, actionId) {
            api.floatingIpsGetAction(ip, actionId)
                .then(data => data.body.action)
                .then(action => {
                    if (action.status === 'completed')
                        resolve(action);
                    else
                        setTimeout(() => checkIsSuccessful(ip, actionId), RESULT_CHECK_DELAY)
                })
                .catch(reject)
        }

        checkIsSuccessful(ip, actionId)
    })
}

function assignNewFloatingIpToDroplet(dropletId) {
    return api.floatingIpsAssignDroplet(dropletId)
        .then(data => {
            return data.body.floating_ip
        })
}

function unAssignFloatingIp(ip) {
    return api.floatingIpsRequestAction(ip, {type: 'unassign'})
        .then(data => data.body.action)
        .then(action => {
            if (action.status === 'in-progress')
                return waitUntilSuccessful(ip, action.id);

            throw new Error('invalid action status\n' + action);
        })
}

function deleteFloatingIp(ip) {
    api.floatingIpsDelete(ip)
        .then(data => {
            if (data.response.statusCode === 204)
                return true;
            else {
                logger.error(data);
                throw new Error('unable to delete floating ip');
            }
        })
}

function findDropletCurrentFloatingIp(dropletName) {
    return api.floatingIpsGetAll()
        .then(data => data.body.floating_ips)
        .then(floatingIps => {
            for (let floatingIp of floatingIps)
                if (floatingIp.droplet && floatingIp.droplet.name === dropletName)
                    return floatingIp;

            throw new NoFloatingIpFoundError(`no floating ip assigned to droplet ${dropletName}`);
        })
}

function getDroplet(dropletName) {
    return api.dropletsGetAll({})
        .then(data => data.body.droplets)
        .then(droplets => {
            for (let d of droplets)
                if (d.name === dropletName)
                    return d;

            throw new NoDropletFoundError(`droplet ${dropletName} not found`);
        })
}

function assignNewIp(dropletName) {
    let dropletId = -1;
    let oldIp = '';
    let newIp = '';

    return getDroplet(dropletName)
        .then(droplet => dropletId = droplet.id)
        .then(_ => findDropletCurrentFloatingIp(dropletName))
        .then(fIp => oldIp = fIp.ip)
        .then(_ => unAssignFloatingIp(oldIp))
        .then(_ => assignNewFloatingIpToDroplet(dropletId))
        .then(fIp => newIp = fIp.ip)
        .then(_ => deleteFloatingIp(oldIp))
        .then(_ => {
            return {oldIp: oldIp, newIp: newIp}
        })
        .catch(err => {
            if (!(err instanceof NoFloatingIpFoundError))
                throw err;


            return assignNewFloatingIpToDroplet(dropletId)
                .then(fIp => {
                    return {
                        newIp: fIp.ip
                    }
                })
        });
}

module.exports = {
    assignNewIp: assignNewIp
};
