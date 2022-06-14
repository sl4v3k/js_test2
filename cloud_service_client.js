//====================================================================
//
//	  Description:
//		  Cloud Service Manager Client
//
//	  Notes: Copyright 2022 Sony Semiconductor Solutions Corporation.
//
//====================================================================
"use strict";

const registerDeviceServiceHost = process.env.REGISTER_DEVICE_SERVICE_HOST;

const stateOperator = require('./update_state_operator.js');

const { getSerialId } = require('./system_service_client.js');
const { getFirmwareVersion } = require('./versions_accessor.js');

const axios = require('axios').create();
const url = require('url');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const uuid = require('uuid');

const expirationPeriod = 1 * 60 * 60; // 1h

const certsDir = '/certs';
const deviceKeyFile = certsDir + '/privatekey.pem';
const deviceCertFile = certsDir + '/cert.pem';


axios.interceptors.request.use(
  (config) => {
    console.log(`${config.method} ${config.baseURL}/${config.url}`);
    return config;
  }
);

axios.interceptors.response.use(
  (response) => {
    console.log(`${response.request.method} ${response.request.protocol}//${response.request.host}${response.request.path}`);
    console.log(`${response.status} ${response.statusText}`);
    console.log(`x-request-id: ${response.headers['x-request-id']}`);
    return response;
  },
  (err) => {
    if (err.request) {
      console.log(`${err.request.method} ${err.request.host}${err.request.path}`);
    }
    if (err.response) {
      console.log(`${err.response.status} ${err.response.statusText}`);
      console.log(`x-request-id: ${err.response.headers['x-request-id']}`);
    }
    return Promise.reject(err);
  }
);


function getTokenAuth(deviceId, endpoint) {
  let token = '';

  try {
    const key = fs.readFileSync(deviceKeyFile);
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      iss: deviceId,
      sub: deviceId,
      aud: endpoint,
      jti: uuid.v4(),
      exp: now + expirationPeriod,
      iat: now,
    };

    token = jwt.sign(claim, key, { algorithm: 'RS256' });
  } catch(err) {
    console.error(`${err.name}: ${err.message}`);
  }

  return token;
}

async function setBaseUrl(host) {
  let setHost;

  if (host === undefined) {
    setHost = await stateOperator.getServiceDomain();
  } else {
    setHost = host;
  }

  if (setHost) {
    const endpoint = url.format({
      protocol: 'https',
      host: setHost,
    });

    axios.defaults.baseURL = endpoint;

    return endpoint;
  }

  return '';
}

async function getDeviceToken(endpoint, deviceId) {
  const jwt = getTokenAuth(deviceId, endpoint);

  const body = new URLSearchParams();
  body.append('clientAssertionType', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
  body.append('clientAssertion', jwt);
  body.append('deviceId', deviceId);
  
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const response = await axios.post('auth/deviceToken', body, { headers });
  return response.data.accessToken;
}

async function updateManifest() {
  console.log('update manifest');

  const deviceId = await getSerialId();
  console.log(`deviceId is '${deviceId}'`);

  const endpoint = await setBaseUrl();
  console.log(`endpoint is '${endpoint}'`);

  if (deviceId && endpoint) {

    try {
      const deviceToken = await getDeviceToken(endpoint, deviceId);

      const headers = {
        Authorization: `Bearer ${deviceToken}`,
      };

      const requireVersion = await stateOperator.getRequireVersion();
      console.log(`requireVersion is '${requireVersion}'`);

      const params = {
        version: requireVersion,
      };

      await axios.post(`devices/${deviceId}/deploy`, null, { headers, params });
      return true;
    } catch (err) {
      console.error(`${err.name}: ${err.message}`);
      return false;
    }
  }

  return false;
}

async function registryDevice() {
  console.log('Registry Device');

  const deviceId = await getSerialId();
  console.log(`deviceId is '${deviceId}'`);

  const endpoint = await setBaseUrl(registerDeviceServiceHost);
  console.log(`endpoint is '${endpoint}'`);

  if (deviceId) {
    const cert = fs.readFileSync(deviceCertFile, {encoding: 'utf-8'});
    const version = getFirmwareVersion();

    const body = {
      devices: [
        {
          deviceId: deviceId,
          deviceCertificate: cert,
          name: deviceId,
          applicationVersion: version,
        },
      ],
    }

    const headers = {
      'Content-Type': 'application/json',
    };

    axios.interceptors.response.use(
      (response) => {
        console.log(`response: ${JSON.stringify(response.data)}`);
        return response;
      },
      (err) => {
        if (err.response) {
          console.log(`response: ${JSON.stringify(err.response.data)}`);
        }
        return Promise.reject(err);
      });
    const response = await axios.post('init/devices', body, { headers });
    const registeredDevices = response.data.registeredDevices;

    if ((registeredDevices.length === 0) || (registeredDevices[0].deviceId !== deviceId)) {
      throw new Error('Failed Regist SerialId');
    }
  } else {
    throw new Error('Failed Get SerialId');
  }
}

exports.updateManifest = updateManifest;
exports.registryDevice = registryDevice;
