# Download vagrant box from file hosting site since vagrant cloud is extremely SLOW
# wget <FILE_HOSTING_URL> -O package.box
# vagrant box remove hobin/create-ctf-competition-template -f
# vagrant box add hobin/create-ctf-competition-template ./package.box

# Create Vagrantfile
tee Vagrantfile << END
Vagrant.configure(2) do |config|
  config.vm.box = "hobin/create-ctf-competition-template"
  config.vm.provider "virtualbox" do |v|
    v.memory = {{VAGRANT_MEMORY}}
    v.cpus = {{VAGRANT_CORE}}
    v.customize ["modifyvm", :id, "--ioapic", "on"]
    v.customize ["modifyvm", :id, "--natdnshostresolver1", "on"]
    v.customize ["modifyvm", :id, "--natdnsproxy1", "on"]
  end
  config.vm.provision "file", source: "./vagrant-install.sh", destination: "~/vagrant-install.sh"
  config.vm.provision "file", source: "./services", destination: "~/services"
  config.vm.provision "shell" do |s|
    s.inline = "sh vagrant-install.sh"
  end
  config.vm.network "forwarded_port", guest: 14567, host: 14567 # Docker Registry
  config.vm.network "forwarded_port", guest: 15001, host: 15001 # Gitlab
  config.vm.network "forwarded_port", guest: 8000, host: 18000 # CTF Dashboard
end
END

# Create vagrant-install.sh which will be executed inside the vagrant box
tee vagrant-install.sh << END
export VAGRANT_HOME=/home/vagrant

git clone https://github.com/KAIST-CS408E/HTTP-CTF.git
sudo mv \$VAGRANT_HOME/services \$VAGRANT_HOME/HTTP-CTF/services
pip install -r \$VAGRANT_HOME/HTTP-CTF/dashboard/requirements.txt

tee \$VAGRANT_HOME/HTTP-CTF/container-creator/example.json << END2
{
    "num_services": {{NUM_SERVICE}},
    "name": "{{CTF_NAME}}",
    "services": {{SERVICE_NAMES}},
    "sudo": true,
    "teams": {{TEAM_NAMES}},
    "flag_storage_folder": "/flags",
    "containers_host": "localhost",
    "containers_ports_start" : 10000,
    "round" : {{N_ROUND}}
}
END2

tee \$VAGRANT_HOME/HTTP-CTF/dashboard/config/firebaseConfig.json << END2
{{FIREBASE_ADMIN_SDK}}
END2

tee \$VAGRANT_HOME/HTTP-CTF/dashboard/config/teamConfig.json << END2
{
    "api_secret": "{{API_SECRET}}",
    "name": "CS408(E)_HTTP_CTF",
    "api_base_url": "http://127.0.0.1:4000",
    "teams": {{TEAM_NAME_PASSWORDS}}
}
END2

tee \$VAGRANT_HOME/HTTP-CTF/dashboard/static/js/firebase.init.js << END2
// Initialize Firebase
var config = {{FIREBASE_CONFIG}};
firebase.initializeApp(config);
END2

tee \$VAGRANT_HOME/HTTP-CTF/database/config/firebaseConfig.json << END2
{{FIREBASE_ADMIN_SDK}}
END2

tee \$VAGRANT_HOME/HTTP-CTF/database/settings.py << END2
DEBUG = True
MYSQL_DATABASE_USER = "root"
MYSQL_DATABASE_INIT_PASSWORD = "http8804"
MYSQL_DATABASE_PASSWORD = "{{MYSQL_DATABASE_PASSWORD}}"
MYSQL_DATABASE_DB = "ctf"
DOCKER_DISTRIBUTION_SERVER = "localhost:5000"
DOCKER_DISTRIBUTION_USER = "root"
DOCKER_DISTRIBUTION_PASS = "http8804"
DOCKER_DISTRIBUTION_EMAIL = "hobincar@kaist.ac.kr"
REMOTE_DOCKER_DAEMON_PORT = 2375
TICK_TIME_IN_SECONDS = {{N_ROUND_TICK}}
DB_SECRET = "{{API_SECRET}}"
GAME_ROUND = {{N_ROUND}}
END2

tee \$VAGRANT_HOME/HTTP-CTF/scorebot/settings.py << END2
DB_HOST = '127.0.0.1:4000'
DB_SECRET = '{{API_SECRET}}'
END2
sudo tee /etc/gitlab/gitlab.rb << END2
external_url 'https://{{DOMAIN_NAME}}:15001'
registry_external_url 'https://{{DOMAIN_NAME}}:14567'
registry['notifications'] = [
  {
    'name' => 'Gameserver',
    'url' => 'http://localhost:4000/container_changed',
    'timeout' => '1s',
    'threshold' => 5,
    'backoff' => '2s',
    'headers' => {
      'secret' => ['{{API_SECRET}}']
    }
  }
]
END2

tee \$VAGRANT_HOME/HTTP-CTF/database/config/teamConfig.json << END2
{
    "teams": {{TEAM_NAME_PASSWORDS}}
}
END2

tee \$VAGRANT_HOME/HTTP-CTF/gitlab/config.json << END2
{
    "teams": {{TEAM_NAME_PASSWORDS}},
    "services": {{SERVICE_NAMES}}
}
END2

tee \$VAGRANT_HOME/HTTP-CTF/gitlab/csr_config.json << END2
[ req ]
distinguished_name="req_distinguished_name"
prompt="no"

[ req_distinguished_name ]
C="KR"
ST="Daejeon"
L="KAIST"
O="{{CTF_NAME}}"
CN="{{DOMAIN_NAME}}"
END2

cd \$VAGRANT_HOME/HTTP-CTF/container-creator
sudo python create_containers.py -sl ../services -c example.json
sudo python create_flag_dirs.py -c example.json

cd \$VAGRANT_HOME/HTTP-CTF/database
sudo python reset_db.py ../container-creator/output/{{CTF_NAME}}/initial_db_state.json

cd \$VAGRANT_HOME/HTTP-CTF/gitlab
sudo mkdir -p /etc/gitlab/ssl
sudo openssl req -x509 -newkey rsa:4096 -keyout /etc/gitlab/ssl/{{DOMAIN_NAME}}.key -out /etc/gitlab/ssl/{{DOMAIN_NAME}}.crt -days 365 -nodes -config csr_config.json
sudo gitlab-ctl reconfigure
sudo gitlab-rails console production < gitlab-temp-passwd.sh
sleep 5
sudo python initialize.py -c config.json

cd \$VAGRANT_HOME/HTTP-CTF/container-creator
sudo docker run -d -p 5000:5000 --restart=always --name docker-registry \
  -v /etc/gitlab/ssl:/certs \
  -e REGISTRY_HTTP_TLS_CERTIFICATE=/certs/{{DOMAIN_NAME}}.crt \
  -e REGISTRY_HTTP_TLS_KEY=/certs/{{DOMAIN_NAME}}.key \
  registry
sudo service docker restart
sudo docker login --username=root --password=temp_passwd localhost:5000
sudo python push_containers.py -sl ../services -c example.json -ds localhost -dpo 5000 -du root -dpass temp_passwd

cd \$VAGRANT_HOME/HTTP-CTF/database
nohup sudo python database_tornado.py &
sleep 30
nohup sudo python gamebot.py &
sleep 30
cd \$VAGRANT_HOME/HTTP-CTF/dashboard
nohup sudo python app.py &
sleep 30
cd \$VAGRANT_HOME/HTTP-CTF/scorebot
nohup sudo python scorebot.py &

sudo service docker restart
END


# Load vagrant box
vagrant destroy -f
vagrant up

# Connect to the vagrant box. You should connected to it to forward ports.
vagrant ssh
