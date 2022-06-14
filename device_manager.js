//====================================================================
//
//	  Description:
//		  Device Manager.
//
//	  Notes: Copyright 2022 Sony Semiconductor Solutions Corporation.
//
//====================================================================
"use strict";

const certsDir = '/certs';
const deviceCertFile = certsDir + '/cert.pem';
const deviceKeyFile = certsDir + '/privatekey.pem';

const fs = require('fs');
const glob = require("glob");
const jwkToPem = require('jwk-to-pem');

const { registryDevice } = require('./cloud_service_client.js');

function isCertExists() {
  try {
    fs.statSync(deviceCertFile);
    fs.statSync(deviceKeyFile);
  } catch (err) {
    return false;
  }
  return true;
}

function getSecurityObject() {
  let object = {};
  const files = glob.sync(certsDir + '/client_credentials_*.json');

  if (files.length == 0) {
    console.error('no security object');
  } else {
    const s = fs.readFileSync(files[0]);
    object = JSON.parse(s);
  }

  return object;
}

function parseSecurityObject() {
  console.log('parse security object start');
  
  const securityObject = getSecurityObject();
  
  if (securityObject.DeviceCertificate) {
    const cert = `-----BEGIN CERTIFICATE-----\n${securityObject.DeviceCertificate}\n-----END CERTIFICATE-----`;
    fs.writeFileSync(deviceCertFile, cert);
  } else {
    throw new Error('no DeviceCertificate');
  }
  
  if (securityObject.DevicePrivateKey) {
    const privatekey = jwkToPem(securityObject.DevicePrivateKey, { private: true });
    fs.writeFileSync(deviceKeyFile, privatekey);
  } else {
    throw new Error('no DevicePrivateKey');
  }
  
  console.log('parse security object end');
}

async function activate() {
  if (!isCertExists()) {
    console.log('activate start');

    try {
      parseSecurityObject();
      await registryDevice();
      return true;
    } catch (err) {
      console.error(`${err.name}: ${err.message}`);

      fs.rmSync(deviceCertFile, { force: true });
      fs.rmSync(deviceKeyFile, { force: true });

      return false;
    }
  }
  return true;
}

exports.activate = activate;
