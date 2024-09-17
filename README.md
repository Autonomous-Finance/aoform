# AOForm

Aoform is a tool to deploy a set of processes to AO. These can be defined in a processes.yaml file.
It uses a statefile to keep track of deployed processes and only updates code when needed.

## Installation
```
npm install --save-dev aoform
```

## Usage
1. install in your AO project
2. create a processes.yaml in your project root
2. set your wallet (`export WALLET_JSON="$(cat ~/.aos.json)"`)
4. run the deploy script (`npx aoform apply`)

## Configuration
The configuration for the deploy script is defined in the `processes.yaml` file. This file is located in the root of your AO project.

## Example processes.yaml
```
- name: dexi-monitor-test-v2-8
  file: build/output.lua
  prerun: reset-modules.lua
  resetModules: true
  scheduler: _GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA
  module: cNlipBptaF9JeFAf4wUmpi43EojNanIBos3EfNrEOWo
  tags:
    - name: Process-Type
      value: Dexi-Aggregator-Test
    - name: Cron-Interval
      value: 10-minute
    - name: Cron-Tag-Action
      value: Cron-Minute-Tick
```

## Options
- name: name of the process
- file: relative path to the main file to deploy
- prerun: relative path to a script that gets executed before the main file
- scheduler: id of the scheduler
- module: id of the module
- tags: list of tags to spawn the process with
- resetModules: if true, all modules except the standard ao libary will be unloaded before your code is eval'ed (default: true)
- directory: if true, the `aoform.directory` package will be enabled. This returns a table with process names as the keys, and process ids as the values. (default: false)
