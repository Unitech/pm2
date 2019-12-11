#!/usr/bin/python
import os
import time

while 1:
    try:
        print(os.environ['DEFAULT_STR'])
    except KeyError:
        print('RAWPython')
    time.sleep(1)
