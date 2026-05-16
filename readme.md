# claude-usage-widget

A browser userscript that adds a small floating widget to [claude.ai](https://claude.ai) showing how much of your usage limit you've spent — with a live countdown until it resets.

![License](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)

<img width="300" alt="minimized" src="https://github.com/user-attachments/assets/e9fdd185-8037-4242-bc34-cffe420b8223" />
<img width="300" alt="expanded" src="https://github.com/user-attachments/assets/e1e1df04-7357-47db-b3ef-47357bf610d2" />

## What it does

- Shows your current usage as a percentage with a timer counting down to reset
- Expand it to see separate bars for your 5-hour and 7-day limits
- Only checks for updates when you're actually on the tab — no background activity if you have Claude open in multiple tabs
- Shows a warning icon if there's a network issue, and retries automatically

## Installation

**Easy install (recommended):**

Open this link with Violentmonkey or Tampermonkey installed — it'll prompt you to install automatically:
[claude-usage-widget.user.js](https://raw.githubusercontent.com/n6ufal/claude-usage-widget/main/claude-usage-widget.user.js)

> Don't have a userscript manager? Install [Violentmonkey](https://violentmonkey.github.io) or [Tampermonkey](https://www.tampermonkey.net) for your browser first, then come back to the link above.

**Manual install:**

1. Open your userscript manager and create a new script
2. Paste in the contents of `claude-usage-widget.user.js`
3. Save, then refresh [claude.ai](https://claude.ai)

## Notes

- Uses an internal Claude API endpoint that isn't officially documented, so it could break if Anthropic changes their backend. The widget will show `API?` if that happens.
- Everything runs locally in your browser. No data leaves your machine — it just reads from your existing Claude session.
- Works on both free and paid plans.

## Credits

Fetch engine, poll logic, and SPA navigation hooks adapted from
[Claude Inline Usage Tracker](https://update.greasyfork.org/scripts/567949) by Niko,
licensed under [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.html).

This project is also licensed under GPL-3.0 as a result.

## License

[GPL-3.0](./LICENSE)
