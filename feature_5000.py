import subprocess
import sys
from typing import Tuple

def run_command(command: str) -> Tuple[int, str, str]:
    """
    Run a shell command and return the exit code, stdout, and stderr.
    """
    try:
        result = subprocess.run(command, shell=True, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return result.returncode, result.stdout, result.stderr
    except subprocess.CalledProcessError as e:
        return e.returncode, e.stdout, e.stderr

def update_pm2():
    """
    Update PM2 and return the exit code, stdout, and stderr.
    """
    update_command = "npm install pm2@latest -g && pm2 update"
    return run_command(update_command)

def main():
    # Update PM2
    exit_code, stdout, stderr = update_pm2()
    
    if exit_code == 0:
        print("PM2 updated successfully.")
        print("STDOUT:", stdout)
    else:
        print("Failed to update PM2.")
        print("STDERR:", stderr)
        sys.exit(1)

# Test cases
if __name__ == "__main__":
    # Run the main function to update PM2
    main()
    
    # Add more test cases if necessary
    # test_run_command("echo 'Hello, World!'")
    # test_run_command("false")
```

This Python script defines a function to run shell commands and a function to update PM2. It also includes a main function to execute the PM2 update and handle the output. The script is designed to be run directly and includes basic error handling and output printing.