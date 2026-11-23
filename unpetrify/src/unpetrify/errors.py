"""The one exception Unpetrify raises on purpose."""


class Refused(ValueError, SystemExit):
    """Unpetrify will not convert this file, and says why (`str(e)`).

    A ValueError, so a caller inside a long-running process -- an MCP server, a batch job -- can
    catch it as it catches any bad input, with `except ValueError` or `except Refused`. Also a
    SystemExit, as every refusal was before 0.1.1: the command line still prints the reason and
    exits 1 when nothing catches it, and code written against the old behaviour
    (`except SystemExit`) keeps working.
    """
