# claude-usage-widget

Never get surprised by a usage limit again. This userscript adds a small floating widget to [claude.ai](https://claude.ai) showing how much of your limit you've spent — with a live countdown until it resets.

![License](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)

## What you get

<img width="300" alt="minimized" src="https://github.com/user-attachments/assets/e9fdd185-8037-4242-bc34-cffe420b8223" />

By default, the widget sits minimized at the top of the page — just your usage percentage and a live timer ticking down to reset. Out of the way, but always visible.

<img width="300" alt="expanded" src="https://github.com/user-attachments/assets/e1e1df04-7357-47db-b3ef-47357bf610d2" />

Click the arrow to expand it. You'll see separate progress bars for your **5-hour** and **7-day** limits, each with their own reset countdown.

A few other things worth knowing:
- Pauses polling when you're not on the tab — no pointless background requests
- Retries automatically if it can't reach the API, and shows a warning if something's wrong
- Draggable — put it wherever it's least in your way

## Installation

You'll need a userscript manager first. If you don't have one, grab [Violentmonkey](https://violentmonkey.github.io) or [Tampermonkey](https://www.tampermonkey.net) for your browser.

**Then just open this link — it'll prompt you to install:**

👉 [claude-usage-widget.user.js](https://raw.githubusercontent.com/n6ufal/claude-usage-widget/main/claude-usage-widget.user.js)

**Or manually:**
1. Open your userscript manager and create a new script
2. Paste in the contents of `claude-usage-widget.user.js`
3. Save, then refresh [claude.ai](https://claude.ai)

## Notes

- Uses an internal Claude API endpoint that isn't officially documented — it could break if Anthropic changes their backend. The widget will show `API?` if that happens.
- Everything runs locally in your browser. No data leaves your machine.
- Works on both free and paid plans.

## Credits

Fetch engine, poll logic, and SPA navigation hooks adapted from [Claude Inline Usage Tracker](https://greasyfork.org/en/scripts/567949-claude-inline-usage-tracker) by Niko, licensed under [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.html). This project is also GPL-3.0 as a result.

## License

[GPL-3.0](./LICENSE)
