//====================================================================
//
//	  Description:
//		  EVP Agent launcher main
//
//	  Notes: Copyright 2022 Sony Semiconductor Solutions Corporation.
//
//====================================================================
"use strict";

const stateOperator = require('./update_state_operator');
const launcher = require('./evp_agent_launcher');
const { updateManifest } = require('./cloud_service_client');
const { isOnline } = require('./system_service_client');
const { activate } = require('./device_manager');

const evpAgentName = 'EvpAgent';
const newEvpAgentName = 'EvpAgentRenewal';


async function renameNewEvpAgentContainer() {
  const newContainer = await launcher.get(newEvpAgentName);

  if (newContainer) {
    const oldContainer = await launcher.get(evpAgentName);
    if (oldContainer) {
      await launcher.remove(oldContainer);
    }
    await launcher.rename(newContainer, evpAgentName);
  }
}

async function onDownloaded() {
  console.log('start on downloaded');

  await renameNewEvpAgentContainer();
  
  if (await updateManifest()) {
    stateOperator.setState(stateOperator.State.manifestUpdated);
    await launcher.start(newEvpAgentName, stateOperator.getRequireEvpAgentImage());
  } else {
    await launcher.start(evpAgentName);
  }
}

async function onManifestUpdated() {
  console.log('start on manifestUpdated');
  
  if (await isOnline()) {
    await launcher.start(newEvpAgentName, stateOperator.getRequireEvpAgentImage());
  } else {
    const newContainer = await launcher.get(newEvpAgentName);
    if (newContainer) {
      await launcher.remove(newContainer);
    }
    await launcher.start(evpAgentName);
  }
}

async function onUpdated() {
  console.log('start on updated');

  await renameNewEvpAgentContainer();
  await launcher.start(evpAgentName);
}

async function onDownloading() {
  console.log('start on downloading');
  
  await renameNewEvpAgentContainer();
  await launcher.start(evpAgentName);
}

async function onReadFailed() {
  console.log('start on read failed');
  
  const newContainer = await launcher.get(newEvpAgentName);
  if (newContainer) {
    await launcher.remove(newContainer);
  }
  
  await launcher.start(evpAgentName);
}

async function main() {
  const ret = await activate();
  if (!ret) {
    process.exit(1);
    return;
  }
  
  try {
    const state = stateOperator.getState();

    switch (state) {
    case stateOperator.State.downloaded:
      await onDownloaded();
      break;
    case stateOperator.State.manifestUpdated:
      await onManifestUpdated();
      break;
    case stateOperator.State.updated:
      await onUpdated();
      break;
    case stateOperator.State.downloading:
    default:
      await onDownloading();
      break;
    }
  } catch (err) {
    await onReadFailed();
  }
}


if (require.main == module) {
  main();
};

exports.main = main;
