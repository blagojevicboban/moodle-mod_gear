# Contributing to GEAR

Thank you for your interest in contributing to the GEAR Moodle plugin!

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/blagojevicboban/moodle-mod_gear/issues)
2. If not, create a new issue with:
   - Moodle version
   - PHP version
   - Browser and device
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable

### Suggesting Features

Open an issue with the `enhancement` label describing:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes following our coding standards
4. Run tests: `vendor/bin/phpunit`
5. Commit with clear messages
6. Push and create a Pull Request

## Coding Standards

This plugin follows [Moodle Coding Style](https://moodledev.io/general/development/policies/codingstyle):

- PHP 8.1+ with type hints
- PHPDoc comments on all functions
- Language strings in alphabetical order
- No MOODLE_INTERNAL check in files without side effects

### Running Code Checks

```bash
# PHP CodeSniffer
vendor/bin/phpcs --standard=moodle mod/gear

# PHPUnit tests
vendor/bin/phpunit --testsuite mod_gear_testsuite

# ESLint (JavaScript)
npx eslint amd/src/

# Stylelint (CSS)
npx stylelint styles.css
```

### Building AMD Modules

```bash
cd /path/to/moodle
npx grunt amd --root=mod/gear
```

## Development Setup

1. Clone into Moodle's mod directory:
   ```bash
   cd /path/to/moodle/mod
   git clone https://github.com/blagojevicboban/moodle-mod_gear.git gear
   ```

2. Install Moodle normally or run:
   ```bash
   php admin/cli/upgrade.php
   ```

3. For JavaScript development, install dependencies:
   ```bash
   npm install
   ```

## License

By contributing, you agree that your contributions will be licensed under the GNU GPL v3.
