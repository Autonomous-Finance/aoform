import fs from 'fs/promises';
import path from 'path';

export const initCommand = async () => {
  const processesYamlPath = path.join(process.cwd(), 'processes.yaml');

  try {
    await fs.access(processesYamlPath);
    console.log('processes.yaml file already exists.');
  } catch {
    const defaultProcessesYaml = `
# Example processes.yaml file
#
# - name: process1
#   file: path/to/process1.lua
#   scheduler: scheduler_address
#   tags:
#     - name: Tag1
#       value: Value1
#     - name: Tag2
#       value: Value2
`.trim();

    await fs.writeFile(processesYamlPath, defaultProcessesYaml, 'utf-8');
    console.log('processes.yaml file created successfully.');
  }
};