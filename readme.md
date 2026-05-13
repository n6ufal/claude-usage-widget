# claude-usage-widget

A Violentmonkey/Tampermonkey userscript that adds a floating usage monitor to [claude.ai](https://claude.ai). Displays your 5-hour and 7-day usage limits with a live countdown timer.

![License](https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square)

## Features

- **Minimized view:** displays current usage percentage and time remaining until reset
- **Expanded view:** shows full 5-hour and 7-day usage bars with reset countdowns
- Live countdown updates every second
- Color-coded indicators for urgency levels (green → yellow → orange → red)
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

[AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html)