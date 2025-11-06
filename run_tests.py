
#!/usr/bin/env python3
"""
Test runner script for comprehensive testing
"""
import subprocess
import sys
import os

def run_tests():
    """Run all tests with coverage reporting"""
    
    print("🧪 Starting comprehensive test suite...")
    
    # Install required packages if not present
    try:
        import pytest
        import pytest_cov
    except ImportError:
        print("📦 Installing testing dependencies...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pytest", "pytest-cov"], check=True)
    
    # Run tests with coverage
    test_commands = [
        # Unit tests with coverage
        [
            "python", "-m", "pytest", 
            "tests/unit/",
            "--cov=src",
            "--cov-report=html",
            "--cov-report=term-missing",
            "--cov-fail-under=80",
            "-v"
        ],
        
        # Integration tests
        [
            "python", "-m", "pytest",
            "tests/integration/",
            "-v"
        ]
    ]
    
    for i, cmd in enumerate(test_commands, 1):
        print(f"\n📋 Running test phase {i}/{len(test_commands)}...")
        try:
            result = subprocess.run(cmd, check=True)
            print(f"✅ Phase {i} completed successfully")
        except subprocess.CalledProcessError as e:
            print(f"❌ Phase {i} failed with exit code {e.returncode}")
            return False
    
    print("\n🎉 All tests completed successfully!")
    print("📊 Coverage report available in htmlcov/index.html")
    return True

def quick_test():
    """Run quick test subset for development"""
    print("⚡ Running quick tests...")
    try:
        subprocess.run([
            "python", "-m", "pytest",
            "tests/unit/",
            "-x",  # stop on first failure
            "--tb=short"
        ], check=True)
        print("✅ Quick tests passed!")
        return True
    except subprocess.CalledProcessError:
        print("❌ Quick tests failed!")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "quick":
        success = quick_test()
    else:
        success = run_tests()
    
    sys.exit(0 if success else 1)
