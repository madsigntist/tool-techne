"""{{TITLE}}: {{PURPOSE}}

Run it:
    python main.py --help
"""
import argparse


def main(argv=None):
    """Reads the command line and does the work.

    Args:
        argv: The arguments, or None to read them from the command line.

    Returns:
        The text it printed, so tests can check it.
    """
    parser = argparse.ArgumentParser(description="{{PURPOSE}}")
    parser.add_argument("--name", default="world", help="who to greet")
    args = parser.parse_args(argv)
    message = f"Hello, {args.name}. {{TITLE}} is set up and working."
    print(message)
    return message


if __name__ == "__main__":
    main()
