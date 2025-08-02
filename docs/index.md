---
---
# **shipshape - a local Windows Deployer**

shipshape is a simple command-line tool to facilitate the deployment of applications to a local server in a Windows environment.

shipshape is solving a problem that caused me pain for a while. I develop small in-house applications of various kinds - from data collection scripts in Python to simple web applications, from command line tools in C# to Excel-based VBA projects. Because of the nature and low importance of these applications, it would not be feasible or sensible to implement a full CI/CD pipeline.

After local development, I have to deploy these applications. Usually, this means copying files from the local device to a UNC path. Following some issues I created for myself with manual “copy and paste deployments”, I built shipshape to automate the process.

**Requirements**
- copy build artefacts from source directory to destination directory
- empty the destination directory beforehand, but with the ability to keep certain items (log files for example)
- run a couple of commands before starting the file copy (pre-deployment)
- run a couple of commands after completing the file copy (post-deployment)
- the ability to target different environments with different configurations
- maintaining all that in a simple configuration file
- integration into existing workflows (npm)



