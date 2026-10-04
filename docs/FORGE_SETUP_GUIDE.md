# Forge Setup & Developer Guide

This document is designed to be copied into **Confluence** as an onboarding guide for new engineers or for setting up a new machine for development.

## 1. Prerequisites
Before working on the project, you need:
- Node.js installed (LTS version recommended).
- A Jira Cloud instance with administrator rights.
- An Atlassian Developer account.

## 2. Global Installation
Install the Forge CLI globally on your machine.
```bash
npm install -g @forge/cli@latest
```

## 3. Authentication (Logging in to Forge)
To authorize your machine to deploy apps to your Atlassian account:
1. Go to your [Atlassian API Tokens page](https://id.atlassian.com/manage-profile/security/api-tokens).
2. Click **Create API Token**. Name it something recognizable (e.g., "Dev Laptop Forge Token").
3. **Copy the token immediately** (store it in your Password Manager like 1Password, Bitwarden, or your browser's secure keychain).
4. In your terminal, run:
```bash
forge login
```
5. Follow the prompts: enter your Atlassian email address and paste the API token you just created.

## 4. Running and Developing the App
Navigate to the project directory (`Art_of_Data`).

### Starting the Tunnel (Hot-Reload)
When developing, use the tunnel to see your changes locally without fully deploying:
```bash
forge tunnel
```
*Note: If you change `manifest.yml` (e.g., adding scopes or new modules), you must stop the tunnel, run `forge deploy`, and then restart the tunnel.*

### Deploying the App
To deploy your changes to the development environment:
```bash
forge deploy -e development
```
*(On Windows PowerShell, use `forge.cmd deploy -e development`)*

### Installing the App
If you are deploying to a new Jira site, you must install it first:
```bash
forge install --site your-site-name.atlassian.net --product jira --environment development
```
To upgrade an existing installation after changing permissions/scopes in `manifest.yml`:
```bash
forge install --upgrade --site your-site-name.atlassian.net --product jira --environment development
```

## 5. Environment Variables (App Secrets)
If the app requires 3rd party API keys (e.g., OpenAI API), **DO NOT** commit them to code.
Set them via the Forge CLI:
```bash
forge variables set --environment development --secret SECRET_NAME "your-api-key"
```
