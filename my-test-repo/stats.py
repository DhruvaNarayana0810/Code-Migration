"""Statistical functions for data analysis."""

def mean(numbers):
    """Calculate the mean (average) of a list of numbers."""
    if not numbers:
        return 0
    return sum(numbers) / len(numbers)

def median(numbers):
    """Calculate the median of a list of numbers."""
    if not numbers:
        return 0
    sorted_numbers = sorted(numbers)
    n = len(sorted_numbers)
    if n % 2 == 1:
        return sorted_numbers[n // 2]
    else:
        mid1 = sorted_numbers[n // 2 - 1]
        mid2 = sorted_numbers[n // 2]
        return (mid1 + mid2) / 2

def mode(numbers):
    """Calculate the mode (most frequent value) of a list of numbers."""
    if not numbers:
        return None
    from collections import Counter
    counts = Counter(numbers)
    return counts.most_common(1)[0][0]

def variance(numbers):
    """Calculate the variance of a list of numbers."""
    if not numbers:
        return 0
    avg = mean(numbers)
    return sum((x - avg) ** 2 for x in numbers) / len(numbers)

def std_dev(numbers):
    """Calculate the standard deviation of a list of numbers."""
    if not numbers:
        return 0
    return variance(numbers) ** 0.5
