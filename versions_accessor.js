//====================================================================
//
//	  Description:
//		  versions.json accessor
//
//	  Notes: Copyright 2022 Sony Semiconductor Solutions Corporation.
//
//====================================================================
"use strict";

const versionsPath = '/root/conf/versions.json';
const defaultEvpAgentImage = 'evp_agent-alpine-small:latest';

const fs = require('fs');


function getFirmwareVersion() {
  let version = '';

  try {
    const obj = JSON.parse(fs.readFileSync(versionsPath));
    version = obj.firmware.version;
  } catch(err) {
    console.error(`${err.name}: ${err.message}`);
  }

  return version;
}

function getEvpAgentImage() {
  let image = defaultEvpAgentImage;
  
  try {
    const obj = JSON.parse(fs.readFileSync(versionsPath));
    const evpAgentObj = obj.application.filter((v) => { return v.name === 'EvpAgent'; })[0];
    image = evpAgentObj.image + ':' + evpAgentObj.tag;
  } catch(err) {
    console.error(`${err.name}: ${err.message}`);
  }

  return image;
}


exports.getFirmwareVersion = getFirmwareVersion;
exports.getEvpAgentImage = getEvpAgentImage;
