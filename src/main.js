const fs = require('fs');
const express = require('express');

const logger = require('./logger');
const {ServerFailureHandler} = require('./server_failure_handler');

const app = express();

const PORT = 8080;

if (process.env.DROPLET_NAME === undefined
    || process.env.DOMAIN === undefined
    || process.env.WATCHDOG_TIMER_TIMEOUT === undefined
    || process.env.REQUEST_TIMEOUT === undefined
    || process.env.CHECK_REQUEST_URL === undefined
    || process.env.DO_ACCESS_TOKEN === undefined
    || process.env.CF_EMAIL === undefined
    || process.env.CF_API_KEY === undefined
    || process.env.FORCE_CHANGE_KEY === undefined
) {
    logger.error('insufficient env variables, exiting...');
    process.exit();
}

let failureHandler = new ServerFailureHandler(process.env.DROPLET_NAME,
    (process.env.ZONE_NAME === undefined) ? process.env.DOMAIN : process.env.ZONE_NAME,
    process.env.DOMAIN,
    process.env.WATCHDOG_TIMER_TIMEOUT,
    process.env.REQUEST_TIMEOUT,
    process.env.CHECK_REQUEST_URL
);

app.get('/', (req, res) => res.send('server is running!'));

app.get('/force-change', (req, res) => {
    if (req.query.k === undefined || req.query.k !== process.env.FORCE_CHANGE_KEY) {
        logger.info('unauthorized access to force-change. skipping...');
        res.send('unauthorized access to force-change. skipping...');
        return;
    }

    logger.info('force ip change requested.');
    res.send('changing ip started. to see progress check <a href="/log">logs</a>');

    failureHandler.changeServerIp()
        .then(res => logger.info('force ip change done!'))
        .catch(res => {})
});

app.get('/history', (req, res) => {
    let str = '<table>' +
        '<thead><th>#</th><th>timestamp</th><th>old ip</th><th>new ip</th></thead>' +
        '<tbody>';

    let i = 1;
    for (let item of failureHandler.history) {

        let row = '<tr>';
        row += `<td>${i}&nbsp;</td>`;
        row += `<td>&nbsp;${item.formattedTimestamp}&nbsp;</td>`;
        row += `<td>&nbsp;${(item.oldIp) ? item.oldIp : ''}&nbsp;</td>`;
        row += `<td>&nbsp;${item.newIp}&nbsp;</td>`;
        row += '</tr><tr></tr>';

        str += row;

        i++;
    }

    str += '</tbody></table>';

    res.send(str);
});

app.get('/log', (req, res) => {
    let filename = 'log.txt';
    fs.readFile(filename, 'ascii', (err, data) => {
        if (err)
            throw err;

        res.send('<pre>' + data + '</pre>')
    });
});

app.listen(PORT, () => logger.info(`server started on port ${PORT}`));