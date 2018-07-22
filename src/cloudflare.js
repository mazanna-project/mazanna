let api = require('cloudflare')({
    email: process.env.CF_EMAIL,
    key: process.env.CF_API_KEY
});

class NoZoneFoundError extends Error {
    constructor(msg) {
        super(msg);
    }
}

class NoDnsRecordFoundError extends Error {
    constructor(msg) {
        super(msg);
    }
}

function getZoneId(zoneName) {
    return api.zones.browse()
        .then(data => {
            for (let zone of data.result)
                if (zone.name === zoneName)
                    return zone;

            throw new NoZoneFoundError(`no zone found for ${zoneName}`)
        })
}

function getDnsRecordForDomain(zoneId, domain) {
    return api.dnsRecords.browse(zoneId)
        .then(data => {
            for (let dns of data.result)
                if (dns.name === domain)
                    return dns;

            throw new NoDnsRecordFoundError(`no dns record found for ${domain}`)
        })
}

function changeDnsRecordIp(zoneId, dnsRecordId, domain, ip) {
    return api.dnsRecords.edit(zoneId, dnsRecordId, {
        type: 'A',
        name: domain,
        content: ip,
    })
}

function applyNewIpToDomain(newIp, domain, zoneName) {
    if (zoneName === undefined)
        zoneName = domain;

    let zoneId = '';
    let dnsRecordId = '';
    return getZoneId(zoneName)
        .then(zone => zoneId = zone.id)
        .then(_ => getDnsRecordForDomain(zoneId, domain))
        .then(dns => dnsRecordId = dns.id)
        .then(_ => changeDnsRecordIp(zoneId, dnsRecordId, domain, newIp))
        .then(res => {
            if (res.success === true)
                return res;

            throw new Error('unable to assign ip ' + res)
        })
}

module.exports = {
    applyNewIpToDomain: applyNewIpToDomain
};