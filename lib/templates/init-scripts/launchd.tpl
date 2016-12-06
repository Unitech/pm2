<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
	  <key>Label</key>
	  <string>com.PM2</string>
	  <key>UserName</key>
	  <string>%USER%</string>
    <key>KeepAlive</key>
    <true/>
	  <key>ProgramArguments</key>
	  <array>
		  <string>/bin/sh</string>
		  <string>-c</string>
		  <string>%PM2_PATH% resurrect</string>
	  </array>
	  <key>RunAtLoad</key>
	  <true/>
	  <key>OnDemand</key>
	  <false/>
	  <key>LaunchOnlyOnce</key>
	  <true/>
	  <key>EnvironmentVariables</key>
    <dict>
      <key>PATH</key>
      <string>%NODE_PATH%</string>
      <key>PM2_HOME</key>
      <string>%HOME_PATH%</string>
    </dict>
	  <key>StandardErrorPath</key>
	  <string>/tmp/com.PM2.err</string>
	  <key>StandardOutPath</key>
	  <string>/tmp/com.PM2.out</string>
  </dict>
</plist>
