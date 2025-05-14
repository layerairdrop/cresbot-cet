# Layer Airdrop Bot

An automation script for interacting with the Layer Airdrop platform to maximize your airdrop opportunities.

## Features

- Automated chat interaction with Layer Airdrop AI
- Proxy support (HTTP and SOCKS5)
- Multiple wallet support
- Configurable chat prompts
- IP rotation
- Colorful logging and interface

## Prerequisites

- Node.js v14 or higher
- npm or yarn

## Installation

1. Clone this repository:
```bash
git clone git@github.com:layerairdrop/crestal-network-bot.git
cd crestal-network-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create required files:
   - `priv.txt` - One private key per line
   - `questions.txt` (optional) - Custom chat prompts, one per line
   - `proxy.txt` (optional) - Proxy list, one per line

## Proxy Format

You can use the following formats in your `proxy.txt` file:

```
ip:port                      # Default protocol is HTTP
protocol://ip:port           # Specify protocol (http or socks5)
protocol://user:pass@ip:port # With authentication
```

## Configuration

Edit the `config.json` file to customize:
- Minimum credit balance
- Request delays
- Chat session parameters:
  - Message count range (20-30 messages by default)
  - Typing delay between messages
  - Session delay between wallet processing
- Default chat prompts
- IP check services

## Usage

Start the bot with:

```bash
npm start
```

Or run directly:

```bash
node index.js
```

You'll be prompted to choose a proxy mode:
1. Run with Monosans Proxy (public proxy list)
2. Run with Private Proxy (from your proxy.txt)
3. Run Without Proxy

## Workflow

The script will:
1. Load private keys from `priv.txt`
2. Setup proxies based on your selection
3. Authenticate each wallet
4. Check credit balance
5. Interact with the Layer Airdrop AI using questions
6. Continue until credit balance falls below minimum threshold
7. Rotate proxies between sessions

## Disclaimer

This tool is for educational purposes only. Use at your own risk. The author is not responsible for any consequences of using this script.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits

Created by [@rmndkyl](https://t.me/rmndkyl)

Join our communities:
- Channel: [https://t.me/layerairdrop](https://t.me/layerairdrop)
- Group: [https://t.me/layerairdropdiskusi](https://t.me/layerairdropdiskusi)