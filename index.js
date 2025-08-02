#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const fsExtra = require('fs-extra');
const configFile = 'shipshape.config.json';

// Get version from package.json
const packageJSON = require('./package.json');
const version = packageJSON.version;

// Ensure the script is running on Windows.
if (process.platform !== 'win32') {
    console.error('This deployment tool is designed to run only on Windows.');
    process.exit(1);
}

// --- Command Line Arguments Parsing ---
const args = process.argv.slice(2);
let environment = null;

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--env' || arg === '-e') {
        environment = args[i + 1];
        i++; // Skip the next argument as it's the environment value
    } else if (arg === '--version' || arg === '-v') {
        console.log(`shipshape v${version}`);
        process.exit(0);
    } else if (arg === '--help' || arg === '-h') {
        showHelp();
        process.exit(0);
    }
}

// --- Configuration Loading ---
const configPath = path.resolve(process.cwd(), configFile);
if (!fs.existsSync(configPath)) {
    console.error(`Error: ${configFile} not found.`);
    console.error('Please create this file to specify deployment settings.');
    process.exit(1);
}

let fullConfig;
try {
    const configFileContent = fs.readFileSync(configPath, 'utf8');
    fullConfig = JSON.parse(configFileContent);
} catch (error) {
    console.error(`Error reading or parsing ${configFile}:`, error);
    process.exit(1);
}

// Determine valid environments
let validEnvironments = [];
if (fullConfig.environments) {
    validEnvironments = Object.keys(fullConfig.environments).map(env => env.toUpperCase());
}

// Validate environment
if (environment) {
    environment = environment.toUpperCase();
}
if (environment && !validEnvironments.includes(environment)) {
    console.error(`Error: Invalid environment "${environment}".`);
    if (validEnvironments.length > 0) {
        console.error(`Valid environments are: ${validEnvironments.join(', ')}`);
    } else {
        console.error('No environments defined in the configuration file.');
    }
    process.exit(1);
}

// Load default configuration
let defaultConfig = {};
if (fullConfig.default) {
    defaultConfig = fullConfig.default;
}

// Load environment-specific configuration
let config;
try {
    // Check if config has environment-specific settings
    if (fullConfig.environments && fullConfig.environments[environment]) {
        console.log(`Using environment-specific configuration for ${environment}`);
        config = { ...defaultConfig, ...fullConfig.environments[environment] };
    } else {
        // Fallback to old format (no environment-specific config)
        console.log('Using default configuration (no environment-specific settings)');
        config = defaultConfig;
    }
} catch (error) {
    console.error(`Error reading or parsing ${configFile}:`, error);
    process.exit(1);
}

// --- Configuration Validation ---
const { source, destination, preDeploy, postDeploy } = config;

if (!source || !destination) {
    console.error(`Error: "source" and "destination" properties are mandatory in ${configFile}.`);
    process.exit(1);
}

if (source === destination) {
    console.error(`Error: "source" and "destination" cannot be the same.`);
    process.exit(1);
}

const sourcePath = path.resolve(process.cwd(), source);
const destinationPath = path.resolve(destination);

if (!fs.existsSync(sourcePath)) {
    console.error(`Error: Source directory not found at "${sourcePath}"`);
    process.exit(1);
}

// --- Helper Functions ---

/**
 * Checks if a given path is a UNC (Universal Naming Convention) path.
 * UNC paths start with \\ and are used for network resources.
 * @param {string} pathToCheck - The path to check.
 * @returns {boolean} True if the path is a UNC path, false otherwise.
 */
const isUNCPath = (pathToCheck) => {
    if (typeof pathToCheck !== 'string') {
        return false;
    }
    
    // UNC paths start with \\ (double backslash)
    return pathToCheck.startsWith('\\\\');
};

/**
 * Empties a directory while preserving files/folders in the keep list.
 * @param {string} dirPath - The directory path to empty.
 * @param {string[]} keepList - Array of files/folders to preserve.
 * @returns {Promise<void>}
 */
const emptyDirWithKeep = async (dirPath, keepList = []) => {
    try {
        // Ensure the directory exists
        await fsExtra.ensureDir(dirPath);
        
        // Read all items in the directory
        const items = await fsExtra.readdir(dirPath);
        
        // Filter out items that should be kept (case-insensitive comparison)
        const itemsToRemove = items.filter(item => !keepList.includes(item.toUpperCase()));
        
        console.log(`Preserving ${keepList.length} items: ${keepList.join(', ')}`);
        console.log(`Removing ${itemsToRemove.length} items from destination`);
        
        // Remove items that are not in the keep list
        for (const item of itemsToRemove) {
            const itemPath = path.join(dirPath, item);
            await fsExtra.remove(itemPath);
        }
    } catch (error) {
        throw new Error(`Failed to empty directory with keep list: ${error.message}`);
    }
};

/**
 * Executes a shell command and logs its output.
 * @param {string} command - The command to execute.
 * @param {string} cwd - The working directory for the command.
 * @returns {Promise<void>}
 */
const runCommand = (command, cwd) => {
    return new Promise((resolve, reject) => {
        console.log(`> Running command: "${command}"`);
        const child = exec(command, { cwd });

        child.stdout.on('data', (data) => {
            process.stdout.write(data);
        });

        child.stderr.on('data', (data) => {
            process.stderr.write(data);
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(`> Command "${command}" finished successfully.`);
                resolve();
            } else {
                console.error(`> Command "${command}" failed with exit code ${code}.`);
                reject(new Error(`Command failed: ${command}`));
            }
        });
    });
};

/**
 * Shows the help message.
 */
function showHelp() {
    console.log(`
Usage: shipshape [options]

Options:
  -e, --env <environment>    Specify the target environment
  -v, --version              Show version number
  -h, --help                 Show this help message

Examples:
  shipshape --env DEV
  shipshape -e PROD
  shipshape --version

Note: configuration settings are defined in your shipshape.config.json file.
Environment-specific configs are read from the "environments" section and override defaults.
If no environment is specified, the "default" section will be used.
    `);
}

// --- Deployment Logic ---

/**
 * The main deployment function.
 */
const deploy = async () => {
    try {
        console.log('Starting deployment...');

        // Define files/directories to preserve in destination (can be configured in config file)
        const keepList = (config.keepList || []).map(item => item.toUpperCase());

        // 1. Run pre-deployment commands if they exist
        if (preDeploy && preDeploy.length > 0) {
            console.log('\n--- Running Pre-deployment Commands ---');
            for (const cmd of preDeploy) {
                await runCommand(cmd, process.cwd());
            }
            console.log('--- Pre-deployment Commands Finished ---\n');
        } else {
            console.log('No pre-deployment commands to run.');
        }

        // 2. Copy files from source to destination
        console.log(`\n--- Copying Files ---`);
        console.log(`From: ${sourcePath}`);
        console.log(`To:   ${destinationPath}`);
        
        // Empty destination directory while preserving files in keepList
        await emptyDirWithKeep(destinationPath, keepList);
        await fsExtra.copy(sourcePath, destinationPath);

        console.log('Files copied successfully.');
        console.log('--- File Copying Finished ---\n');

        // 3. Run post-deployment commands if they exist
        if (postDeploy && postDeploy.length > 0) {
            console.log('\n--- Running Post-deployment Commands ---');
            const postDeployPath = isUNCPath(destinationPath) ? process.cwd() : destinationPath;
            for (const cmd of postDeploy) {
                // Run post-deploy commands in the context of the destination directory
                await runCommand(cmd, postDeployPath);
            }
            console.log('--- Post-deployment Commands Finished ---\n');
        } else {
            console.log('No post-deployment commands to run.');
        }

        console.log('✅ Deployment completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Deployment failed!');
        console.error('Error:', error.message);
        process.exit(1);
    }
};

// --- Execute ---
deploy();
