import dotenv from 'dotenv';
dotenv.config();

console.log(`aoform v1.0.4`);

import yaml from 'js-yaml';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { connect, createDataItemSigner } from '@permaweb/aoconnect';

// Function to get the hash of a file
function getFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

async function spawnProcess(ao, processInfo, state, signer) {
  const name = processInfo.name;
  const tags = processInfo.tags || [];

  let processId;
  console.log("Spawning process...", {
    module: processInfo.module,
    scheduler: processInfo.scheduler,
    signer,
    tags,
  })

  if (!state[name] || !state[name].processId) {
    let spawnAttempts = 0;
    const maxSpawnAttempts = 5;
    const spawnDelay = 30000; // 30 seconds

    while (spawnAttempts < maxSpawnAttempts) {
      try {
        processId = await ao.spawn({
          module: processInfo.module,
          scheduler: processInfo.scheduler,
          signer,
          tags,
        });
        console.log("Spawned process:", processId);
        break;
      } catch (err) {
        spawnAttempts++;
        console.log('err', err)
        console.log(`Failed to spawn process '${name}'. Attempt ${spawnAttempts}/${maxSpawnAttempts}`);
        if (spawnAttempts === maxSpawnAttempts) {
          console.error('error', err);
          console.error(`Failed to spawn process '${name}' after ${maxSpawnAttempts} attempts.`);
          process.exit(1)
        } else {
          console.log(`Retrying in ${spawnDelay / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, spawnDelay));
        }
      }
    }
  } else {
    processId = state[name].processId;
    console.log(`Using existing process ID '${processId}' for process '${name}'.`);
  }

  return processId;
}

// Function to deploy a process
async function deploySource(ao, processInfo, state, signer, directory) {
  const name = processInfo.name;
  const processId = directory[name];
  const filePath = processInfo.file;
  const currentHash = getFileHash(filePath);
  const prerunFilePath = processInfo.prerun || ''; // Get the prerun file path, or an empty string if not provided

  // Check if the process has already been deployed
  if (state[name]) {
    const processState = state[name];
    const lastHash = processState.hash;

    if (lastHash === currentHash) {
      console.log(`Process '${name}' is up-to-date.`);
      return;
    }
  }

  // Load the Lua file
  const mainScript = fs.readFileSync(filePath, 'utf8');

  // Load the prerun script, if provided
  let prerunScript = '';
  if (prerunFilePath) {
    prerunScript = fs.readFileSync(prerunFilePath, 'utf8');
  }

  let directoryCode = '';
  if (processInfo.directory === true) {
    directoryCode = `
      package.preload["aoform.directory"] = {
        ${Object.keys(directory).map((key) => `["${key}"] = "${directory[key]}"`).join(',\n')}
      }
      `;
  }

  let resetModulesCode = '';
  if (processInfo.resetModules !== false) {
    resetModulesCode = `
      INITIAL_MODULES = { ".crypto.mac.hmac", "string", ".crypto.cipher.morus", "debug", ".handlers", ".crypto.padding.zero", ".crypto.digest.sha2_256", ".crypto.digest.md2", ".crypto.util.hex", ".default", ".eval", ".crypto.util.bit", ".utils", ".crypto.util.stream", "_G", "json", ".crypto.cipher.norx", ".base64", ".crypto.cipher.aes256", ".crypto.digest.md4", ".crypto.util.queue", ".stringify", ".handlers-utils", ".crypto.cipher.issac", "utf8", ".crypto.cipher.aes", ".dump", ".process", ".crypto.cipher.mode.cfb", "ao", ".pretty", ".crypto.digest.sha1", "coroutine", ".crypto.cipher.aes128", ".crypto.init", ".crypto.digest.sha2_512", ".crypto.cipher.aes192", ".crypto.kdf.pbkdf2", ".crypto.mac.init", ".crypto.digest.init", "package", "table", ".crypto.cipher.mode.ctr", ".crypto.util.array", "bit32", ".crypto.cipher.mode.ecb", ".crypto.kdf.init", ".assignment", ".crypto.cipher.mode.cbc", ".crypto.digest.blake2b", ".crypto.digest.sha3", ".crypto.digest.md5", ".crypto.cipher.mode.ofb", "io", "os", ".chance", ".crypto.util.init", ".crypto.cipher.init" }
      
      local function isInitialModule(value)
          for _, v in pairs(INITIAL_MODULES) do
              if v == value then
                  return true
              end
          end
          return false
      end

      for k, _ in pairs(package.loaded) do
          if not isInitialModule(k) then
              package.loaded[k] = nil
          end
      end
      `;
  }

  // Concatenate the prerun script with the main script
  const luaCode = `${directoryCode}\n${resetModulesCode}\n${prerunScript}\n${mainScript}`;

  // Try sending the 'eval' action 5 times with a 30-second delay
  let attempts = 0;
  const maxAttempts = 5;
  const delay = 30000; // 30 seconds

  console.log("Sending code...")
  while (attempts < maxAttempts) {
    try {
      const messageId = await ao.message({
        process: processId,
        data: luaCode,
        tags: [
          {
            name: 'Action',
            value: 'Eval'
          }
        ],
        signer
      });
      console.log(`Successfully sent 'eval' action for process '${name}'.`);
      console.log(messageId);

      const result = await ao.result({
        process: processId,
        message: messageId
      });

      if (result.Error) {
        console.error('Error on `eval` action ', JSON.stringify(result.Error))
        process.exit(1)
      }

      console.log(`Successfully sent 'eval' action for process '${name}'.`);
      console.log('Eval message id', messageId);

      console.log('view result on ao.link:')
      console.log(`https://www.ao.link/#/message/${messageId}`)
      break;
    } catch (err) {
      attempts++;
      console.error('error', err)

      console.log(`Failed to send 'eval' action for process '${name}'. Attempt ${attempts}/${maxAttempts}`);
      if (attempts === maxAttempts) {
        console.error(`Failed to send 'eval' action for process '${name}' after ${maxAttempts} attempts.`);
        process.exit(1)
      } else {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Update the state
  state[name] = {
    processId,
    hash: currentHash,
  };
}

export async function deployProcesses(customFilePath) {
  if (!process.env.WALLET_JSON) {
    console.error("Missing WALLET_JSON environment variable. Please provide the wallet JSON in the environment variable WALLET_JSON.");
    process.exit(1);
  }

  const wallet = JSON.parse(process.env.WALLET_JSON); // Read wallet from environment variable
  const signer = createDataItemSigner(wallet);

  // Load the YAML file
  const stateFile = customFilePath ? 'state-' + customFilePath : 'state.yaml'
  const processesYamlPath = path.join(process.cwd(), customFilePath || 'processes.yaml');
  let processes = [];
  try {
    const processesYaml = fs.readFileSync(processesYamlPath, 'utf8');
    processes = yaml.load(processesYaml);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
    console.warn('processes.yaml file not found. No processes will be deployed or updated.');
  }

  // Load the state file or create a new one
  let state;
  try {
    const stateYamlPath = path.join(process.cwd(), stateFile);
    const stateYaml = fs.readFileSync(stateYamlPath, 'utf8');
    state = yaml.load(stateYaml);
  } catch (err) {
    if (err.code === 'ENOENT') {
      state = {};
    } else {
      throw err;
    }
  }

  // Connect to the AO network
  const ao = connect();

  console.log(ao)

  // Spawn processes
  let directory = {}
  for (const processInfo of processes) {
    directory[processInfo.name] = await spawnProcess(ao, processInfo, state, signer);
  }

  // Update processes source
  for (const processInfo of processes) {
    await deploySource(ao, processInfo, state, signer, directory);
  }

  // Save the updated state
  const updatedState = yaml.dump(state);
  const stateYamlPath = path.join(process.cwd(), stateFile);
  fs.writeFileSync(stateYamlPath, updatedState, 'utf8');
}
