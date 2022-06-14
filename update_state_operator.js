//====================================================================
//
//	  Description:
//		  Update State Operator.
//
//	  Notes: Copyright 2022 Sony Semiconductor Solutions Corporation.
//
//====================================================================
"use strict";

const evpAgentImageName = 'evp_agent-alpine-small';
const stateFile = process.env.STATE_FILE || '/root/update/update.json';

const fs = require('fs');


const State = {
  updated:         'updated',
  downloading:     'downloading',
  downloaded:      'downloaded',
  manifestUpdated: 'manifestUpdated',
};

function readStateFile() {
  try {
    fs.statSync(stateFile);
    const str = fs.readFileSync(stateFile, {encoding: 'utf-8'});
    return JSON.parse(str);
  } catch(err) {
    console.error(`${err.name}: ${err.message}`);
    return {};
  }
}

function writeStateFile(json) {
  const tmpFile = stateFile + '.tmp';
  
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(json));
    fs.renameSync(tmpFile, stateFile);
  } catch (e) {
    console.error(e);
  }
}

function setState(state) {
  const json = readStateFile();
  json.state = state;
  writeStateFile(json);
}

function getState() {
  let state = State.updated;
  const json = readStateFile();

  if (Object.keys(State).includes(json.state)) {
    state = State[json.state];
  } else {
    throw new Error('parse error');
  }

  return state;
}

function getServiceDomain() {
  const json = readStateFile();
  return json.serviceDomain;
}

function getRequireVersion() {
  const json = readStateFile();
  return json.require.version;
}

function getRequireEvpAgentImage() {
  const json = readStateFile();

  try {
    return json.require.images.find((obj) => {
      return obj.startsWith(evpAgentImageName + ':');
    });
  } catch (err) {
    /* do nothing */
  }

  return null;
}


exports.State = State;
exports.setState = setState;
exports.getState = getState;
exports.getServiceDomain = getServiceDomain;
exports.getRequireVersion = getRequireVersion;
exports.getRequireEvpAgentImage = getRequireEvpAgentImage;
