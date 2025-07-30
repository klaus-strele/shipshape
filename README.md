# **shipshape - a local Windows Deployer**

shipshape is a simple command-line tool to facilitate the deployment of applications to a local server in a **Windows environment**.

**Note:** This tool is designed for and will only run on Microsoft Windows (`win32` platform).

## **Features**

* Copies build artifacts from a source directory to a destination.  
* Executes pre-deployment commands (e.g., running a build script).  
* Executes post-deployment commands (e.g., restarting a server).  
* Configuration driven by a simple `json` file.
* Environment-specific deployments with different configurations.

## **Prerequisites**

* [Node.js](https://nodejs.org/) (version 20 or higher)  
* Microsoft Windows Operating System

## **Installation**

Install the package globally using npm. This will make the `shipshape` command available in your command line or PowerShell.

```cmd
npm install -g .
```

*(Note: you run this from the directory where you have the package files, or `npm install -g <package-name>` if published to a registry)*

## **Usage**

### **Basic Usage**

```cmd
shipshape [options]
```

### **Command Line Options**

* `-e, --env <environment>`: Specify the target environment (DEV, UAT, PROD)
* `-h, --help`: Show help message

### **Examples**

```cmd
# Deploy to DEV environment (default)
shipshape

# Deploy to specific environment
shipshape --env UAT
shipshape -e PROD

# Show help
shipshape --help
```

### **Configuration Setup**

1. **Create a Configuration File**
    In the root directory of the project you want to deploy, create a file named `shipshape.config.json`

    **Option 1: Environment-specific Configuration (Recommended)**
    ```json
    {
      "default": {
        "source": "build",
        "preDeploy": [
          "npm install",
          "npm run build"
        ],
        "postDeploy": []
      },
      "environments": {
        "DEV": {
          "destination": "C:\\inetpub\\wwwroot\\myapp-dev",
          "postDeploy": [
            "echo Deployed to DEV environment"
          ]
        },
        "UAT": {
          "destination": "C:\\inetpub\\wwwroot\\myapp-uat",
          "preDeploy": [
            "npm run build",
            "npm run test"
          ],
          "postDeploy": [
            "echo Deployed to UAT environment",
            "echo Running smoke tests..."
          ]
        },
        "PROD": {
          "destination": "C:\\inetpub\\wwwroot\\myapp-prod",
          "preDeploy": [
            "npm run build",
            "npm run test",
            "npm run lint"
          ],
          "postDeploy": [
            "echo Deployed to PRODUCTION environment",
            "echo %date% %time% >> deployment.log"
          ]
        }
      }
    }
    ```

    **Option 2: Legacy Single Configuration**
    ```json
    {
      "source": "build",  
      "destination": "C:\\path\\to\\your\\server\\root",  
      "preDeploy": [  
        "npm install",  
        "npm run build"  
      ],  
      "postDeploy": [  
        "iisreset /stop",  
        "iisreset /start"  
      ]  
    }
    ```
    
2. **Configure package.json**  
    In your project's `package.json`, add deployment scripts:

    ```json
    "scripts": {  
      "deploy": "shipshape",
      "deploy:dev": "shipshape --env DEV",
      "deploy:uat": "shipshape --env UAT",
      "deploy:prod": "shipshape --env PROD"
    }     
    ```

3. **Run the Deployment**  
   Execute the script from your project's root directory:

   ```cmd 
   # Deploy to default environment (DEV)
   npm run deploy
   
   # Deploy to specific environments
   npm run deploy:dev
   npm run deploy:uat
   npm run deploy:prod
   
   # Or use shipshape directly
   shipshape --env PROD
   ```

   The tool will then:  
   1. Run the commands listed in `preDeploy`.  
   2. Copy the contents of the `source` directory to the `destination`.  
   3. Run the commands listed in `postDeploy`.

## **Configuration Options**

### **Environment-specific Configuration**

When using environment-specific configuration, the structure is:

* `default` (object): Base configuration that applies to all environments
* `environments` (object): Environment-specific overrides

Each environment configuration can override any property from the default configuration.

### **Configuration Properties**

* `source` (string, **required**): The path to the directory containing the files to be deployed (e.g., dist, build). This is relative to the project root.  
* `destination` (string, **required**): The absolute path to the target deployment directory on your local server.  
* `preDeploy` (array of strings, optional): A list of commands to execute before the files are copied. These are run in the *project's root directory*.  
* `postDeploy` (array of strings, optional): A list of commands to execute after the files have been copied. These are run in the *destination* directory unless it is a **UNC path**. In this case it falls back to the *project's root directory*.
* `keepList` (array of strings, optional): A list of files or directories in the destination that should be preserved during deployment. These will not be deleted when the destination is emptied.

### **Keep List Feature**

The `keepList` allows you to preserve important files and directories in the destination during deployment:

```json
{
  "default": {
    "source": "./dist",
    "keepList": [
      "web.config",
      "logs",
      ".env",
      "uploads"
    ]
  },
  "environments": {
    "PROD": {
      "destination": "C:\\inetpub\\wwwroot\\myapp-prod",
      "keepList": [
        "web.config",
        "logs",
        "uploads",
        "user-data",
        "certificates",
        "deployment.log"
      ]
    }
  }
}
```

**Note:** entries in the `keepList` are case-insensitive but will be converted to uppercase internally

**Common files to preserve:**

- `web.config` - IIS configuration files
- `logs` - Application log directories
- `.env` - Environment configuration files
- `uploads` - User-uploaded content
- `certificates` - SSL certificates
- `user-data` - Persistent user data
- Configuration files specific to the deployment environment

### **Environment Selection**

* If no environment is specified, the tool **defaults to the first environment** defined in the configuration
* For environment-specific configurations: Valid environments are dynamically read from the `environments` section
* For legacy configurations: Defaults to `DEV`, `UAT`, `PROD`
* Environment names are case-insensitive but will be converted to uppercase internally
* You can define custom environments like `LOCAL`, `DEVELOPMENT`, `STAGING`, `INTEGRATION`, `PRODUCTION`, etc.

### **Custom Environments Example**

You can define any environments you need:

```json
{
  "default": {
    "source": "./dist",
    "preDeploy": ["npm run build"]
  },
  "environments": {
    "LOCAL": {
      "destination": "C:\\temp\\myapp-local"
    },
    "DEVELOPMENT": {
      "destination": "C:\\inetpub\\wwwroot\\myapp-dev"
    },
    "STAGING": {
      "destination": "C:\\inetpub\\wwwroot\\myapp-staging",
      "preDeploy": ["npm run build", "npm run test"]
    },
    "PRODUCTION": {
      "destination": "C:\\inetpub\\wwwroot\\myapp-prod",
      "preDeploy": ["npm run build", "npm run test", "npm run lint"]
    }
  }
}
```

Then deploy with: `shipshape --env STAGING` or `shipshape --env LOCAL`

This setup provides a straightforward way to automate your local deployment process on Windows with support for multiple environments.

License
-------

Licensed under MIT

Copyright (c) 2025 [Klaus Strele](https://github.com/klaus-strele)
