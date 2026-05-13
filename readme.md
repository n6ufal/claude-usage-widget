# claude-usage-widget

A Violentmonkey/Tampermonkey userscript that adds a floating usage monitor to [claude.ai](https://claude.ai). Displays your 5-hour and 7-day usage limits with a live countdown timer.

![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

<img width="300" alt="minimized" src="https://github.com/user-attachments/assets/e9fdd185-8037-4242-bc34-cffe420b8223" />
<img width="300" alt="expanded" src="https://github.com/user-attachments/assets/e1e1df04-7357-47db-b3ef-47357bf610d2" />


## Features

- Minimized view: displays current usage percentage and time remaining until reset
- Expanded view: shows full 5-hour and 7-day usage bars with reset countdowns
- Draggable widget
- Displays `API?` notification if the usage endpoint structure changes

## Installation

**One-click install:**
[claude-usage-widget.user.js](https://raw.githubusercontent.com/n6ufal/claude-usage-widget/main/claude-usage-widget.user.js)

Open the link above with Violentmonkey or Tampermonkey active, and it will prompt you to install automatically.

**Manual installation:**
1. Open your userscript manager dashboard
2. Create a new script
3. Paste the contents of `claude-usage-widget.user.js`
4. Save and refresh [claude.ai](https://claude.ai)

## Notes

- Uses Claude's internal `/api/organizations/{uuid}/usage` endpoint, which is undocumented and may change without notice.
- All data remains in your browser. Requests use your existing claude.ai session.
- Compatible with both free and paid plans.

## License

[MIT](https://opensource.org/licenses/MIT)
