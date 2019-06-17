<?xml version="1.0"?>
<!DOCTYPE service_bundle SYSTEM "/usr/share/lib/xml/dtd/service_bundle.dtd.1">
<service_bundle type="manifest" name="%SERVICE_NAME%">
    <service name="application/%SERVICE_NAME%" type="service" version="1">
        <create_default_instance enabled="false"/>
        <single_instance/>
        
        <dependency name="network" grouping="require_all" restart_on="error" type="service">
            <service_fmri value="svc:/milestone/network:default"/>
        </dependency>
        
        <dependency name="filesystem" grouping="require_all" restart_on="error" type="service">
            <service_fmri value="svc:/system/filesystem/local"/>
        </dependency>
        
        <method_context>
            <method_environment>
                <envvar name='PATH' value="%NODE_PATH%:/usr/local/sbin:/usr/local/bin:/opt/local/sbin:/opt/local/bin:/usr/sbin:/usr/bin:/sbin"/>
                <envvar name='PM2_HOME' value="%HOME_PATH%"/>
            </method_environment>
        </method_context>

        <exec_method type="method" name="start" exec="%PM2_PATH% resurrect" timeout_seconds="60"/>
        <exec_method type="method" name="refresh" exec="%PM2_PATH% reload all" timeout_seconds="60"/>
        <exec_method type="method" name="stop" exec="%PM2_PATH% kill" timeout_seconds="60"/>
        
        <property_group name="startd" type="framework">
            <propval name="duration" type="astring" value="contract"/>
            <propval name="ignore_error" type="astring" value="core,signal"/>
        </property_group>
        
        <property_group name="application" type="application"></property_group>
        <stability value="Evolving"/>
        
        <template>
            <common_name>
                <loctext xml:lang="C">
                    PM2 process manager
                </loctext>
            </common_name>
        </template>
    </service>
</service_bundle>