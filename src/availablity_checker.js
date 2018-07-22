const axios = require('axios');
const https = require('https');

const logger = require('./logger');

const httpClient = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    }),
});

function failIfNotAvailable(url, timeout) {
    if (timeout === undefined)
        timeout = 10000;

    let config = {
        validateStatus: function (status) {
            return status >= 200 && status < 500; // default
        },
        timeout: timeout
    };

    return httpClient.get(url, config)
        .then(data => data.data !== null && data.data !== undefined)
}


module.exports = {
    failIfNotAvailable: failIfNotAvailable
};