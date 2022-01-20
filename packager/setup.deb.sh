#!/bin/bash

REPOSITORY_OWNER="Keymetrics"

show_banner ()
{
    echo
    echo "__/\\\\\\\\\\\\\\\\\\\\\\\\\\____/\\\\\\\\____________/\\\\\\\\____/\\\\\\\\\\\\\\\\\\_____"
    echo " _\\/\\\\\\/////////\\\\\\_\\/\\\\\\\\\\\\________/\\\\\\\\\\\\__/\\\\\\///////\\\\\\___"
    echo "  _\\/\\\\\\_______\\/\\\\\\_\\/\\\\\\//\\\\\\____/\\\\\\//\\\\\\_\\///______\\//\\\\\\__"
    echo "   _\\/\\\\\\\\\\\\\\\\\\\\\\\\\\/__\\/\\\\\\\\///\\\\\\/\\\\\\/_\\/\\\\\\___________/\\\\\\/___"
    echo "    _\\/\\\\\\/////////____\\/\\\\\\__\\///\\\\\\/___\\/\\\\\\________/\\\\\\//_____"
    echo "     _\\/\\\\\\_____________\\/\\\\\\____\\///_____\\/\\\\\\_____/\\\\\\//________"
    echo "      _\\/\\\\\\_____________\\/\\\\\\_____________\\/\\\\\\___/\\\\\\/___________"
    echo "       _\\/\\\\\\_____________\\/\\\\\\_____________\\/\\\\\\__/\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_"
    echo "        _\\///______________\\///______________\\///__\\///////////////__"
    echo "                          Community Edition Setup"
    echo
}

unknown_os ()
{
    echo "Unfortunately, your operating system distribution and version might not be supported by this script."
    echo
    echo "You can override the OS detection by setting os= and dist= prior to running this script."
    echo "For example, to force Ubuntu Trusty: os=ubuntu dist=trusty ./script.sh"
    echo
    echo "For more informations, please read the documentation on http://pm2.io/"
    exit 1
}

gpg_check ()
{
    echo "Checking for gpg..."
    if command -v gpg > /dev/null; then
        echo "Detected gpg..."
    else
        echo "Installing gnupg for GPG verification..."
        apt-get install -y gnupg
        if [ "$?" -ne "0" ]; then
            echo "Unable to install GPG! Your base system has a problem; please check your default OS's package repositories because GPG should work."
            echo "Repository installation aborted."
            exit 1
        fi
    fi
}

curl_check ()
{
    echo "Checking for curl..."
    if command -v curl > /dev/null; then
        echo "Detected curl..."
    else
        echo "Installing curl..."
        apt-get install -q -y curl
        if [ "$?" -ne "0" ]; then
            echo "Unable to install curl! Your base system has a problem; please check your default OS's package repositories because curl should work."
            echo "Repository installation aborted."
            exit 1
        fi
    fi
}

install_debian_keyring ()
{
    if [ "${os}" = "debian" ]; then
        echo "Installing debian-archive-keyring which is needed for installing "
        echo "apt-transport-https on many Debian systems."
        apt-get install -y debian-archive-keyring &> /dev/null
    fi
}


detect_os ()
{
    if [[ ( -z "${os}" ) && ( -z "${dist}" ) ]]; then
        # some systems dont have lsb-release yet have the lsb_release binary and
        # vice-versa
        if [ -e /etc/lsb-release ]; then
            . /etc/lsb-release

            if [ "${ID}" = "raspbian" ]; then
                os=${ID}
                dist=`cut --delimiter='.' -f1 /etc/debian_version`
            else
                os=${DISTRIB_ID}
                dist=${DISTRIB_CODENAME}

                if [ -z "$dist" ]; then
                    dist=${DISTRIB_RELEASE}
                fi
            fi

        elif [ `which lsb_release 2>/dev/null` ]; then
            dist=`lsb_release -c | cut -f2`
            os=`lsb_release -i | cut -f2 | awk '{ print tolower($1) }'`

        elif [ -e /etc/debian_version ]; then
            # some Debians have jessie/sid in their /etc/debian_version
            # while others have '6.0.7'
            os=`cat /etc/issue | head -1 | awk '{ print tolower($1) }'`
            if grep -q '/' /etc/debian_version; then
                dist=`cut --delimiter='/' -f1 /etc/debian_version`
            else
                dist=`cut --delimiter='.' -f1 /etc/debian_version`
            fi

        else
            unknown_os
        fi
    fi

    if [ -z "$dist" ]; then
        unknown_os
    fi

    # remove whitespace from OS and dist name
    os="${os// /}"
    dist="${dist// /}"

    echo "Detected operating system as $os/$dist."
}

install_node ()
{
    # Official install method of
    # https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions
    # without using sudo.
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - || exit 1
}

main ()
{
    show_banner
    detect_os
    curl_check
    gpg_check

    # Need to first run apt-get update so that apt-transport-https can be
    # installed
    echo -n "Running apt-get update... "
    apt-get update &> /dev/null
    echo "done."

    # Install the debian-archive-keyring package on debian systems so that
    # apt-transport-https can be installed next
    install_debian_keyring

    echo -n "Installing apt-transport-https... "
    apt-get install -y apt-transport-https &> /dev/null
    echo "done."

    install_node

    gpg_key_url="https://packagecloud.io/$REPOSITORY_OWNER/pm2/gpgkey"
    apt_config_url="https://packagecloud.io/install/repositories/$REPOSITORY_OWNER/pm2/config_file.list?os=${os}&dist=${dist}&source=script"

    apt_source_path="/etc/apt/sources.list.d/"$REPOSITORY_OWNER"_pm2.list"

    echo -n "Installing $apt_source_path..."

    # create an apt config file for this repository
    curl -sSf "${apt_config_url}" > $apt_source_path
    curl_exit_code=$?

    if [ "$curl_exit_code" = "22" ]; then
        echo "This script is unable to download the repository definition."
        echo
        [ -e $apt_source_path ] && rm $apt_source_path
        unknown_os
    elif [ "$curl_exit_code" = "35" -o "$curl_exit_code" = "60" ]; then
        echo "curl is unable to connect to packagecloud.io over TLS when running: "
        echo "    curl ${apt_config_url}"
        echo "This is usually due to one of two things:"
        echo
        echo " 1.) Missing CA root certificates (make sure the ca-certificates package is installed)"
        echo " 2.) An old version of libssl. Try upgrading libssl on your system to a more recent version"
        echo
        echo "Contact support@packagecloud.io with information about your system for help."
        [ -e $apt_source_path ] && rm $apt_source_path
        exit 1
    elif [ "$curl_exit_code" -gt "0" ]; then
        echo
        echo "Unable to run: "
        echo "    curl ${apt_config_url}"
        echo
        echo "Double check your curl installation and try again."
        [ -e $apt_source_path ] && rm $apt_source_path
        exit 1
    else
        echo "done."
    fi

    echo -n "Importing packagecloud gpg key... "
    # import the gpg key
    curl -L "${gpg_key_url}" 2> /dev/null | apt-key add - &>/dev/null
    echo "done."

    echo -n "Running apt-get update... "
    # update apt on this system
    apt-get update &> /dev/null
    echo "done."

    echo -n "Installing PM2..."
    apt-get install -y pm2 &> /dev/null
    echo "done."

    CURR_USER=$SUDO_USER
    if [ "$CURR_USER" == "" ]; then
        CURR_USER=$USER
    fi

    if [ "$CURR_USER" == "root" ] || [ "$CURR_USER" == "" ]; then
        echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
        echo "WARNING: You are either running this script as root or the"
        echo "         \$USER variable is empty. In order to have a"
        echo "         working PM2 installation, you need to add your"
        echo "         user in the pm2 group using the following"
        echo "         command:      usermod -aG pm2 <username>"
        echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
    else
        echo -n "Adding $CURR_USER to group pm2..."
        usermod -aG pm2 $CURR_USER
        echo "done."
    fi
    echo
    echo "Installation done."
    echo "You now need to logout of your system and login again in order to be able to use the 'pm2' command."
}

main

