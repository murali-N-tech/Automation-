# AI Placement Officer Chrome Extension

## Local install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this `extension/` folder.

## Usage

1. From the web app, click `Open + Extension Apply` on a matched job.
2. Copy your current JWT token and application id into extension popup.
3. On a supported ATS page, click `Save & Autofill Current Tab`.
4. Review all autofilled fields manually and submit yourself.
5. Return to web app and click `Mark Applied`.

## Supported ATS mappers

- Greenhouse
- Lever
- Workday (basic selector coverage)

## Security notes

- Never auto-submits forms.
- Requires explicit user action from popup.
- Uses bearer token to fetch apply context from backend.
