"""Main module that orchestrates all functionality and produces deterministic output."""

from calculator import add, subtract, multiply, divide, power
from stats import mean, median, mode, variance, std_dev
from utils import clamp, round_to, is_even, is_odd, factorial, fibonacci

def main():
    """Run all functions and print deterministic, quantifiable results."""
    
    print("=== CALCULATOR OPERATIONS ===")
    print(f"add(10, 5) = {add(10, 5)}")
    print(f"subtract(10, 5) = {subtract(10, 5)}")
    print(f"multiply(10, 5) = {multiply(10, 5)}")
    print(f"divide(10, 5) = {divide(10, 5)}")
    print(f"power(2, 8) = {power(2, 8)}")
    
    print("\n=== STATISTICS ===")
    data = [1, 2, 3, 4, 5]
    print(f"data = {data}")
    print(f"mean({data}) = {mean(data)}")
    print(f"median({data}) = {median(data)}")
    print(f"mode([1, 1, 2, 2, 2, 3]) = {mode([1, 1, 2, 2, 2, 3])}")
    print(f"variance({data}) = {round_to(variance(data), 2)}")
    print(f"std_dev({data}) = {round_to(std_dev(data), 4)}")
    
    print("\n=== UTILITIES ===")
    print(f"clamp(15, 0, 10) = {clamp(15, 0, 10)}")
    print(f"clamp(-5, 0, 10) = {clamp(-5, 0, 10)}")
    print(f"round_to(3.14159, 2) = {round_to(3.14159, 2)}")
    print(f"is_even(4) = {is_even(4)}")
    print(f"is_odd(7) = {is_odd(7)}")
    print(f"factorial(5) = {factorial(5)}")
    print(f"fibonacci(10) = {fibonacci(10)}")
    
    print("\n=== COMBINED OPERATIONS ===")
    complex_data = [2, 4, 6, 8, 10]
    result = mean(complex_data)
    clamped = clamp(result, 5, 7)
    print(f"mean({complex_data}) = {result}")
    print(f"clamp(result, 5, 7) = {clamped}")
    print(f"is_even(clamp_result) = {is_even(int(clamped))}")

if __name__ == "__main__":
    main()
