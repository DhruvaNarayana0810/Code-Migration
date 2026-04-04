"""Utility helper functions."""

def clamp(value, min_val, max_val):
    """Clamp a value between min and max."""
    return max(min_val, min(value, max_val))

def round_to(value, decimals):
    """Round a value to a specific number of decimal places."""
    multiplier = 10 ** decimals
    return int(value * multiplier) / multiplier

def is_even(num):
    """Check if a number is even."""
    return num % 2 == 0

def is_odd(num):
    """Check if a number is odd."""
    return num % 2 != 0

def factorial(n):
    """Calculate factorial of n."""
    if n < 0:
        raise ValueError("Factorial not defined for negative numbers")
    if n == 0 or n == 1:
        return 1
    return n * factorial(n - 1)

def fibonacci(n):
    """Get the nth Fibonacci number."""
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    else:
        a, b = 0, 1
        for _ in range(2, n + 1):
            a, b = b, a + b
        return b
