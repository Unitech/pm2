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

curl_check ()
{
    echo "Checking for curl..."
    if command -v curl > /dev/null; then
        echo "Detected curl..."
    else
        echo "Installing curl..."
        yum install -d0 -e0 -y curl
    fi
}


detect_os ()
{
    if [[ ( -z "${os}" ) && ( -z "${dist}" ) ]]; then
        if [ -e /etc/os-release ]; then
            . /etc/os-release
            os=${ID}
            if [ "${os}" = "poky" ]; then
                dist=`echo ${VERSION_ID}`
            elif [ "${os}" = "sles" ]; then
                dist=`echo ${VERSION_ID}`
            elif [ "${os}" = "opensuse" ]; then
                dist=`echo ${VERSION_ID}`
            else
                dist=`echo ${VERSION_ID} | awk -F '.' '{ print $1 }'`
            fi

        elif [ `which lsb_release 2>/dev/null` ]; then
            # get major version (e.g. '5' or '6')
            dist=`lsb_release -r | cut -f2 | awk -F '.' '{ print $1 }'`

            # get os (e.g. 'centos', 'redhatenterpriseserver', etc)
            os=`lsb_release -i | cut -f2 | awk '{ print tolower($1) }'`

        elif [ -e /etc/oracle-release ]; then
            dist=`cut -f5 --delimiter=' ' /etc/oracle-release | awk -F '.' '{ print $1 }'`
            os='ol'

        elif [ -e /etc/fedora-release ]; then
            dist=`cut -f3 --delimiter=' ' /etc/fedora-release`
            os='fedora'

        elif [ -e /etc/redhat-release ]; then
            os_hint=`cat /etc/redhat-release  | awk '{ print tolower($1) }'`
            if [ "${os_hint}" = "centos" ]; then
                dist=`cat /etc/redhat-release | awk '{ print $3 }' | awk -F '.' '{ print $1 }'`
                os='centos'
            elif [ "${os_hint}" = "scientific" ]; then
                dist=`cat /etc/redhat-release | awk '{ print $4 }' | awk -F '.' '{ print $1 }'`
                os='scientific'
            else
                dist=`cat /etc/redhat-release  | awk '{ print tolower($7) }' | cut -f1 --delimiter='.'`
                os='redhatenterpriseserver'
            fi

        else
            aws=`grep -q Amazon /etc/issue`
            if [ "$?" = "0" ]; then
                dist='6'
                os='aws'
            else
                unknown_os
            fi
        fi
    fi

    if [[ ( -z "${os}" ) || ( -z "${dist}" ) ]]; then
        unknown_os
    fi

    # remove whitespace from OS and dist name
    os="${os// /}"
    dist="${dist// /}"

    echo "Detected operating system as ${os}/${dist}."
}

finalize_yum_repo ()
{
    echo "Installing pygpgme to verify GPG signatures..."
    yum install -y pygpgme --disablerepo='Keymetrics_pm2'
    pypgpme_check=`rpm -qa | grep -qw pygpgme`
    if [ "$?" != "0" ]; then
        echo
        echo "WARNING: "
        echo "The pygpgme package could not be installed. This means GPG verification is not possible for any RPM installed on your system. "
        echo "To fix this, add a repository with pygpgme. Usualy, the EPEL repository for your system will have this. "
        echo "More information: https://fedoraproject.org/wiki/EPEL#How_can_I_use_these_extra_packages.3F"
        echo

        # set the repo_gpgcheck option to 0
        sed -i'' 's/repo_gpgcheck=1/repo_gpgcheck=0/' /etc/yum.repos.d/Keymetrics_pm2.repo
    fi

    echo "Installing yum-utils..."
    yum install -y yum-utils --disablerepo='Keymetrics_pm2'
    yum_utils_check=`rpm -qa | grep -qw yum-utils`
    if [ "$?" != "0" ]; then
        echo
        echo "WARNING: "
        echo "The yum-utils package could not be installed. This means you may not be able to install source RPMs or use other yum features."
        echo
    fi

    echo "Generating yum cache for Keymetrics_pm2..."
    yum -q makecache -y --disablerepo='*' --enablerepo='Keymetrics_pm2'
}

finalize_zypper_repo ()
{
    zypper --gpg-auto-import-keys refresh Keymetrics_pm2
}

install_node ()
{
    curl --silent --location https://rpm.nodesource.com/setup_lts.x | bash - || exit 1
}

install_pm2 ()
{
    PKG_MANAGER=$1
    echo -n "Installing PM2 with $PKG_MANAGER..."
    $PKG_MANAGER install -y pm2 2> /dev/null

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
}

main ()
{
    show_banner
    detect_os
    curl_check

    yum_repo_config_url="https://packagecloud.io/install/repositories/$REPOSITORY_OWNER/pm2/config_file.repo?os=${os}&dist=${dist}&source=script"

    if [ "${os}" = "sles" ] || [ "${os}" = "opensuse" ]; then
        yum_repo_path=/etc/zypp/repos.d/Keymetrics_pm2.repo
    else
        yum_repo_path=/etc/yum.repos.d/Keymetrics_pm2.repo
        install_node
    fi

    echo "Downloading repository file: ${yum_repo_config_url}"

    curl -sSf "${yum_repo_config_url}" > $yum_repo_path
    curl_exit_code=$?

    if [ "$curl_exit_code" = "22" ]; then
        echo
        echo
        echo -n "Unable to download repo config from: "
        echo "${yum_repo_config_url}"
        echo
        echo "This usually happens if your operating system is not supported by "
        echo "packagecloud.io, or this script's OS detection failed."
        echo
        echo "You can override the OS detection by setting os= and dist= prior to running this script."
        echo "You can find a list of supported OSes and distributions on our website: https://packagecloud.io/docs#os_distro_version"
        echo
        echo "For example, to force CentOS 6: os=el dist=6 ./script.sh"
        echo
        echo "If you are running a supported OS, please email support@packagecloud.io and report this."
        [ -e $yum_repo_path ] && rm $yum_repo_path
        exit 1
    elif [ "$curl_exit_code" = "35" -o "$curl_exit_code" = "60" ]; then
        echo
        echo "curl is unable to connect to packagecloud.io over TLS when running: "
        echo "    curl ${yum_repo_config_url}"
        echo
        echo "This is usually due to one of two things:"
        echo
        echo " 1.) Missing CA root certificates (make sure the ca-certificates package is installed)"
        echo " 2.) An old version of libssl. Try upgrading libssl on your system to a more recent version"
        echo
        echo "Contact support@packagecloud.io with information about your system for help."
        [ -e $yum_repo_path ] && rm $yum_repo_path
        exit 1
    elif [ "$curl_exit_code" -gt "0" ]; then
        echo
        echo "Unable to run: "
        echo "    curl ${yum_repo_config_url}"
        echo
        echo "Double check your curl installation and try again."
        [ -e $yum_repo_path ] && rm $yum_repo_path
        exit 1
    else
        echo "done."
    fi

    if [ "${os}" = "sles" ] || [ "${os}" = "opensuse" ]; then
        finalize_zypper_repo
        install_pm2 zypper
    else
        finalize_yum_repo
        install_pm2 yum
    fi

    echo
    echo "Installation done."
    echo "You now need to logout of your system and login again in order to be able to use the 'pm2' command."
}

main
