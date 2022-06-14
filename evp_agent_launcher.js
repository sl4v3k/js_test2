//====================================================================
//
//	  Description:
//		  EVP Agent launcher
//
//	  Notes: Copyright 2022 Sony Semiconductor Solutions Corporation.
//
//====================================================================
"use strict";

const evpMqttHost = process.env.EVP_MQTT_HOST;
const evpMqttPort = process.env.EVP_MQTT_PORT || 8883;
const evpMqttTlsCaCert = process.env.EVP_MQTT_TLS_CA_CERT;
const evpMqttTlsClientCert = process.env.EVP_MQTT_TLS_CLIENT_CERT;
const evpMqttTlsClientKey = process.env.EVP_MQTT_TLS_CLIENT_KEY;

const { getEvpAgentImage } = require('./versions_accessor.js');

// MUST bind this host directory to container,
// and match base dir of sdk.sock defined in deployment manifest.
const evpAgentDataDir = '/tmp/evp_agent/init';

const axios = require('axios').create();

axios.defaults.socketPath = '/var/run/docker.sock';
axios.defaults.baseURL = 'http:/v1.41';

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
    return response;
  },
  (err) => {
    if (err.request) {
      console.log(`${err.request.method} ${err.request.host}${err.request.path}`);
    }
    if (err.response) {
      console.log(`${err.response.status} ${err.response.statusText}`);
    }
    return Promise.reject(err);
  }
);


const randomstring = require('randomstring');
const fs = require('fs');

const deploymentManifestVolumeNamePrefix = 'evp_deployment_manifest_';


async function generateDeploymentManifestVolumeName() {
  let name = '';

  while (name.length == 0) {
    const suffix = randomstring.generate(7);
    name = deploymentManifestVolumeNamePrefix + suffix;
    const params = {
      filters: {name: [name]}
    };

    const response = await axios.get('volumes', { params });
    if (response.data.Volumes.length != 0) {
      name = '';
    }
  }

  console.log(`deployment manifest volume name '${name}'`);
  return name;
}

async function removeDanglingDeploymentManifestVolume() {
  const params = {
    filters: {
      name: [deploymentManifestVolumeNamePrefix],
      dangling: ['true']
    },
  };
  const response = await axios.get('volumes', { params });
  
  response.data.Volumes.forEach(async (volume) => {
    await axios.delete(`volumes/${volume.Name}`);
  });
}

async function createContainer(containerName, containerImage) {
  console.log(`create container '${containerName}' '${containerImage}`);

  const deploymentManifestVolumeName = await generateDeploymentManifestVolumeName();

  if (!containerImage) {
    containerImage = getEvpAgentImage();
  }

  fs.rmSync(evpAgentDataDir, { force: true, recursive: true });
  
  const body = {
    Image: containerImage,
    Env: [
      `EVP_MQTT_HOST=${evpMqttHost}`,
      `EVP_MQTT_PORT=${evpMqttPort}`,
      'EVP_MQTT_TLS_CA_CERT=/certs/ca_cert.pem',
      'EVP_MQTT_TLS_CLIENT_CERT=/certs/client_cert.pem',
      'EVP_MQTT_TLS_CLIENT_KEY=/certs/client_key.pem',
      'EVP_DOCKER_HOST=http://dockerd',
      'EVP_DOCKER_UNIX_SOCKET=/var/run/docker.sock',
      `EVP_MODULE_INSTANCE_DIR_FOR_DOCKERD=${evpAgentDataDir}/instances`,
      'ASAN_OPTIONS=detect_stack_use_after_return=1:check_initialization_order=1:detect_leaks=1',
      'LSAN_OPTIONS=verbosity=1:log_threads=1',
      'EVP_REPORT_STATUS_INTERVAL_MIN_SEC=3',
      'EVP_REPORT_STATUS_INTERVAL_MAX_SEC=3',
      'USE_GDBSERVER=0',
      'EVP_TLS_KEYLOGFILE=/tmp/logs/key.log'
    ],
    HostConfig: {
      Init: true,
      Binds: [
        '/var/run/docker.sock:/var/run/docker.sock:rw',
        `${evpAgentDataDir}:/evp_data:rw`,
        `${deploymentManifestVolumeName}:/evp_data/twins:rw`,
        `${evpMqttTlsCaCert}:/certs/ca_cert.pem:ro`,
        `${evpMqttTlsClientCert}:/certs/client_cert.pem:ro`,
        `${evpMqttTlsClientKey}:/certs/client_key.pem:ro`
      ],
    }
  };

  const response = await axios.post(`containers/create?name=${encodeURI(containerName)}`, body);
  console.log(`Id: ${response.data.Id}`);

  return response.data.Id;
}

async function getContainer(containerName) {
  console.log(`get container '${containerName}'`);
  
  let result = null;
  const params = {
    all: true,
    filters: {name: [containerName]}
  };
  
  const response = await axios.get('containers/json', { params });
  response.data.forEach((container) => {
    if (container.Names.includes(`/${containerName}`)) {
      result = container.Id;
      console.log(`container found '${container.Id}'`);
    }
  });
  
  return result;
}

async function startContainer(containerName, containerImage) {
  console.log(`start container '${containerName}'`);
  
  let containerId = await getContainer(containerName);

  if (!containerId) {
    containerId = await createContainer(containerName, containerImage);
  }
  
  await axios.post(`containers/${containerId}/start`, null);
}

async function removeContainer(containerId) {
  console.log(`remove container '${containerId}'`);
  
  const params = {
    v: true,
  };

  await axios.delete(`containers/${containerId}`, { params });
  
  await removeDanglingDeploymentManifestVolume();
}

async function renameContainer(containerId, newName) {
  console.log(`rename container '${containerId}' '${newName}'`);
  
  const params = {
    name: newName,
  };

  await axios.post(`containers/${containerId}/rename`, null, { params });
}


exports.get = getContainer;
exports.start = startContainer;
exports.remove = removeContainer;
exports.rename = renameContainer;

