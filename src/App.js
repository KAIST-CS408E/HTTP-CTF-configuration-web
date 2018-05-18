import React, { Component } from 'react';
import { Step, Segment, Input, Label, Table, Container, Button, Icon, Form, TextArea, Divider, Item } from 'semantic-ui-react';
import * as html2canvas from 'html2canvas';
import * as jsPDF from 'jspdf';
import 'semantic-ui-css/semantic.min.css';
import 'lato-font/css/lato-font.css';
import './App.css';

class App extends Component {
  state = {
    step: 1,
    name: 'Awesome-CTF',
    memory: 4,
    core: 2,
    nRound: 20,
    nRoundTick: 600,
    apiSecret: Array(16).fill(0).map(x => Math.random().toString(36).charAt(2)).join(''),
    mysqlPassword: Array(16).fill(0).map(x => Math.random().toString(36).charAt(2)).join(''),
    dockerRegistryPassword: Array(16).fill(0).map(x => Math.random().toString(36).charAt(2)).join(''),
    teams: [
      { id: 'team1', password: Array(16).fill(0).map(x => Math.random().toString(36).charAt(2)).join('') },
      { id: 'team2', password: Array(16).fill(0).map(x => Math.random().toString(36).charAt(2)).join('') },
    ],
    services: ['poipoi', 'sillybox', 'tattletale'],
    firebaseConfig: '',
    firebaseAdminSDK: '',
  };

  placeholder = {
    name: 'Name for your CTF',
    memory: 'Memory to use',
    core: 'The number of core to use',
    nRound: 'The number of rounds',
    nRoundTick: 'The number of seconds per each round',
    apiSecret: 'Secret string for API',
    mysqlPassword: 'Password for mysql',
    dockerRegistryPassword: 'Password for docker registry',
    firebaseConfig: `
        {
          apiKey: "...",
          authDomain: "...",
          databaseURL: "...",
          projectId: "...",
          storageBucket: "...",
          messagingSenderId: "..."
        }
      `.split('\n').map(e => e.trim()).map(e => e.startsWith("{") || e.startsWith("}") ? e : `\t${e}`).join('\n'),
    firebaseAdminSDK: `
      {
        "type": "...",
        "project_id": "...",
        "private_key_id": "...",
        "private_key": "...",
        "client_email": "...",
        "client_id": "...",
        "auth_uri": "...",
        "token_uri": "...",
        "auth_provider_x509_cert_url": "...",
        "client_x509_cert_url": "..."
      }
    `.split('\n').map(e => e.trim()).map(e => e.startsWith("{") || e.startsWith("}") ? e : `\t${e}`).join('\n'),
  };

  ref = {
    teamIDs: {},
    teamPasswords: {},
    services: {},
  };

  async configure() {
    /* Form Validation */
    const { name, memory, core, nRound, nRoundTick, apiSecret, mysqlPassword, dockerRegistryPassword, teams, services, firebaseConfig, firebaseAdminSDK } = this.state;
    if (!name) return this.setState({ step: 1 }, () => this.ref.name.focus());
    if (!memory) return this.setState({ step: 1 }, () => this.ref.memory.focus());
    if (!nRound) return this.setState({ step: 1 }, () => this.ref.nRound.focus());
    if (!nRoundTick) return this.setState({ step: 1 }, () => this.ref.nRoundTick.focus());
    if (!apiSecret) return this.setState({ step: 1 }, () => this.ref.apiSecret.focus());
    if (!mysqlPassword) return this.setState({ step: 1 }, () => this.ref.mysqlPassword.focus());
    if (!dockerRegistryPassword) return this.setState({ step: 1 }, () => this.ref.dockerRegistryPassword.focus());
    for (const [i, team] of teams.entries()) {
      if (!team.id) return this.setState({ step: 2 }, () => this.ref.teamIDs[i].focus());
      if (!team.password) return this.setState({ step: 2 }, () => this.ref.teamPasswords[i].focus());
    }
    for (const [i, service] of services.entries()) {
      if (!service) return this.setState({ step: 3 }, () => this.ref.services[i].focus());
    }
    if (!firebaseConfig) return this.setState({ step: 4 }, () => this.ref.firebaseConfig.focus());
    if (!firebaseAdminSDK) return this.setState({ step: 4 }, () => this.ref.firebaseAdminSDK.focus());

    /* Generate install.sh */
    const num_services = services.length;
    const teamNames = teams.map(team => ({
      name: team.id,
      namespace: team.id,
    }));
    const teamNamePasswords = {};
    teams.forEach((team, i) => {
      teamNamePasswords[i] = {
        name: team.id,
        hashed_password: team.password,
      };
    });

    const res = await fetch("https://firebasestorage.googleapis.com/v0/b/cs408e-http.appspot.com/o/install.template.sh?alt=media&token=c5ed6a90-026e-48f3-8345-8528fa5995e0");
    const commandLineTemplate = await res.text();
    const commandLines = commandLineTemplate.replace(/{{VAGRANT_MEMORY}}/g, memory * 1024)
      .replace(/{{VAGRANT_CORE}}/g, core)
      .replace(/{{NUM_SERVICE}}/g, num_services)
      .replace(/{{CTF_NAME}}/g, name)
      .replace(/{{SERVICE_NAMES}}/g, JSON.stringify(services))
      .replace(/{{TEAM_NAMES}}/g, JSON.stringify(teamNames))
      .replace(/{{FIREBASE_ADMIN_SDK}}/g, firebaseAdminSDK)
      .replace(/{{TEAM_NAME_PASSWORDS}}/g, JSON.stringify(teamNamePasswords))
      .replace(/{{FIREBASE_CONFIG}}/g, firebaseConfig)
      .replace(/{{N_ROUND_TICK}}/g, nRoundTick)
      .replace(/{{API_SECRET}}/g, apiSecret)
      .replace(/{{MYSQL_DATABASE_PASSWORD}}/g, mysqlPassword)
      .replace(/{{DOCKER_DISTRIBUTION_PASSWORD}}/g, dockerRegistryPassword)
      .replace(/{{N_ROUND}}/g, nRound);


    /* Download install.sh */
    const a = document.createElement("a");
    a.setAttribute('href', `data:application/txt,${encodeURIComponent(commandLines)}`);
    a.setAttribute('download', 'install.sh');
    a.click();
  }

  printSummary = () => {
    const { name, firebaseConfig, firebaseAdminSDK } = this.state;
    const input = document.querySelector('#ctf-summary');
    input.querySelector('#summary-firebase-config').innerHTML = '{ ... }';
    input.querySelector('#summary-firebase-admin-sdk').innerHTML = '{ ... }';
    html2canvas(input)
      .then((canvas) => {
        input.querySelector('#summary-firebase-config').innerHTML = firebaseConfig;
        input.querySelector('#summary-firebase-admin-sdk').innerHTML = firebaseAdminSDK;
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF();
        pdf.addImage(imgData, 'JPEG', 0, 0);
        pdf.save(`${name}.summary.pdf`);
      })
    ;
  }

  renderStep() {
    const { step, name, memory, core, nRound, nRoundTick, apiSecret, mysqlPassword, dockerRegistryPassword, teams, services, firebaseConfig, firebaseAdminSDK } = this.state;
    switch (step) {
      case 1: return (
        <Table celled selectable>
          <Table.Body>
            <Table.Row>
              <Table.Cell>Name of your CTF</Table.Cell>
              <Table.Cell>
                <Input
                  placeholder={this.placeholder.name}
                  value={name}
                  onChange={e => this.setState({ name: e.target.value.replace(/\s/g, '-') })}
                  ref={n => this.ref.name = n}
                />
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>Memory quota</Table.Cell>
              <Table.Cell>
                <Input labelPosition='right' type='number' step='0.1' placeholder={this.placeholder.memory}>
                  <input
                    value={memory}
                    onChange={e => this.setState({ memory: e.target.value })}
                    ref={n => this.ref.memory = n}
                  />
                  <Label>GB</Label>
                </Input>
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>Core quota</Table.Cell>
              <Table.Cell>
                <Input labelPosition='right' type='number' placeholder={this.placeholder.core}>
                  <input
                    value={core}
                    onChange={e => this.setState({ core: e.target.value })}
                    ref={n => this.ref.core = n}
                  />
                  <Label>cores</Label>
                </Input>
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>Total number of rounds</Table.Cell>
              <Table.Cell>
                <Input labelPosition='right' type='number' placeholder={this.placeholder.nRound}>
                  <input
                    value={nRound}
                    onChange={e => this.setState({ nRound: e.target.value })}
                    ref={n => this.ref.nRound = n}
                  />
                  <Label>rounds</Label>
                </Input>
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>Time for each round</Table.Cell>
              <Table.Cell>
                <Input labelPosition='right' type='number' placeholder={this.placeholder.nRoundTick}>
                  <input
                    value={nRoundTick}
                    onChange={e => this.setState({ nRoundTick: e.target.value })}
                    ref={n => this.ref.nRoundTick = n}
                  />
                  <Label>seconds</Label>
                </Input>
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>API secret</Table.Cell>
              <Table.Cell>
                <Input
                  placeholder={this.placeholder.apiSecret}
                  value={apiSecret}
                  onChange={e => this.setState({ apiSecret: e.target.value })}
                  ref={n => this.ref.apiSecret = n}
                />
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>Mysql password</Table.Cell>
              <Table.Cell>
                <Input
                  placeholder={this.placeholder.mysqlPassword}
                  value={mysqlPassword}
                  onChange={e => this.setState({ mysqlPassword: e.target.value })}
                  ref={n => this.ref.mysqlPassword = n}
                />
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>Docker registry password</Table.Cell>
              <Table.Cell>
                <Input
                  placeholder={this.placeholder.dockerRegistryPassword}
                  value={dockerRegistryPassword}
                  onChange={e => this.setState({ dockerRegistryPassword: e.target.value })}
                  ref={n => this.ref.dockerRegistryPassword = n}
                />
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
      );
      case 2: return (
        <Table celled selectable>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell />
              <Table.HeaderCell>Team ID</Table.HeaderCell>
              <Table.HeaderCell>Team Password</Table.HeaderCell>
              <Table.HeaderCell collapsing>
                <Button
                  icon
                  style={{ width: '100%'}}
                  labelPosition='left'
                  primary size='small'
                  onClick={() => {
                    const { teams } = this.state;
                    teams.push({
                      id: `team${teams.length + 1}`,
                      password: Array(16).fill(0).map(x => Math.random().toString(36).charAt(2)).join(''),
                    });
                    this.setState({ teams });
                  }}
                >
                  <Icon name='group' /> Add Team
                </Button>
              </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {
              teams.map((team, i) => (
                <Table.Row key={i}>
                  <Table.Cell>{ `Team #${i + 1}` }</Table.Cell>
                  <Table.Cell>
                    <Input
                      placeholder={ `Team #${i + 1} ID` }
                      value={ team.id }
                      onChange={e => {
                        const { teams } = this.state;
                        teams[i].id = e.target.value.replace(/\s/g, '-');
                        this.setState({ teams });
                      }}
                      ref={n => this.ref.teamIDs[i] = n}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Input
                      placeholder={ `Team #${i + 1} Password` }
                      value={ team.password }
                      onChange={e => {
                        const { teams } = this.state;
                        teams[i].password = e.target.value;
                        this.setState({ teams });
                      }}
                      ref={n => this.ref.teamPasswords[i] = n}
                    />
                  </Table.Cell>
                  <Table.Cell collapsing>
                    <Button
                      icon='remove'
                      style={{ width: '100%'}}
                      color='red'
                      onClick={() => {
                        const { teams } = this.state;
                        teams.splice(i, 1);
                        this.setState({ teams });
                      }}
                    />
                  </Table.Cell>
                </Table.Row>
              ))
            }
          </Table.Body>
        </Table>
      );
      case 3: return (
        <Table celled selectable>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell />
              <Table.HeaderCell>Service Name</Table.HeaderCell>
              <Table.HeaderCell collapsing>
                <Button
                  icon
                  style={{ width: '100%'}}
                  labelPosition='left'
                  primary size='small'
                  onClick={() => {
                    const { services } = this.state;
                    services.push(`service${services.length + 1}`);
                    this.setState({ services });
                  }}
                >
                  <Icon name='game' /> Add Service
                </Button>
              </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {
              services.map((service, i) => (
                <Table.Row key={i}>
                  <Table.Cell>{ `Service #${i + 1}` }</Table.Cell>
                  <Table.Cell>
                    <Input
                      placeholder={`Service #${i + 1} Name`}
                      value={service}
                      onChange={e => {
                        const { services } = this.state;
                        services[i] = e.target.value;
                        this.setState({ services });
                      }}
                      ref={n => this.ref.services[i] = n}
                    />
                  </Table.Cell>
                  <Table.Cell collapsing>
                    <Button
                      icon='remove'
                      style={{ width: '100%'}}
                      color='red'
                      onClick={() => {
                        const { services } = this.state;
                        services.splice(i, 1);
                        this.setState({ services });
                      }}
                    />
                  </Table.Cell>
                </Table.Row>
              ))
            }
          </Table.Body>
        </Table>
      );
      case 4: return (
        <Table celled selectable>
          <Table.Body>
            <Table.Row>
              <Table.Cell collapsing />
              <Table.Cell>

                <Item>
                  <Item.Content>
                    <Item.Description>1. Go to <a href='https://firebase.google.com' target='_blank'>Firebase Homepage</a> & Login using your google acount.</Item.Description>
                  </Item.Content>
                  <Item.Image src='https://firebasestorage.googleapis.com/v0/b/cs408e-http.appspot.com/o/firebase-step-1.png?alt=media&token=f6c425e0-8cf0-466c-807a-0e16a72b3343' />
                </Item>
                <Item>
                  <Item.Content>
                    <Item.Description>2. Move to your console.</Item.Description>
                  </Item.Content>
                  <Item.Image src='https://firebasestorage.googleapis.com/v0/b/cs408e-http.appspot.com/o/firebase-step-2.png?alt=media&token=d0f2ea9e-b937-4dff-bad9-ff8634cf9658' />
                </Item>
                <Item>
                  <Item.Content>
                    <Item.Description>3. Click 'Add project' & Create a new project with a name and a country you like.</Item.Description>
                  </Item.Content>
                  <Item.Image src='https://firebasestorage.googleapis.com/v0/b/cs408e-http.appspot.com/o/firebase-step-31.png?alt=media&token=cfd58a2c-cc8a-46ac-971b-ba3b13668c64' />
                  <Item.Image src='https://firebasestorage.googleapis.com/v0/b/cs408e-http.appspot.com/o/firebase-step-32.png?alt=media&token=b9b8f57b-6b7d-4b96-9f80-ea3bf6163619' />
                </Item>
                <Item>
                  <Item.Content>
                    <Item.Description>4. Click this button to get a json string, and copy & paste it into the 'Firebase Configuration' text box below.</Item.Description>
                  </Item.Content>
                  <Item.Image src='https://firebasestorage.googleapis.com/v0/b/cs408e-http.appspot.com/o/firebase-step-41.png?alt=media&token=1f423229-33b7-4e3d-b5e9-771327e12b5f' />
                  <Item.Image src='https://firebasestorage.googleapis.com/v0/b/cs408e-http.appspot.com/o/firebase-step-42.png?alt=media&token=3521ed14-ef6e-423a-87c8-13bc9ee0fe19' />
                </Item>
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell collapsing>Firebase Configuration</Table.Cell>
              <Table.Cell>
                <Form>
                  <TextArea
                    autoHeight
                    placeholder={this.placeholder.firebaseConfig}
                    value={firebaseConfig}
                    onChange={e => this.setState({ firebaseConfig: e.target.value })}
                    ref={n => this.ref.firebaseConfig = n}
                  />
                </Form>
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell collapsing />
              <Table.Cell>
                <Item>
                  <Item.Content>
                    <Item.Description>5. Go to 'Project Setting'.</Item.Description>
                  </Item.Content>
                  <Item.Image src='https://firebasestorage.googleapis.com/v0/b/cs408e-http.appspot.com/o/firebase-step-5.png?alt=media&token=b596e029-15f4-4abc-9ece-b8d942576ce5' />
                </Item>
                <Item>
                  <Item.Content>
                    <Item.Description>6. Go to 'Service Account' tab &  Click 'Generate new secret key' button to get a json file, open it, and copy & paste it into the 'Firebase Admin SDK' text box below.</Item.Description>
                  </Item.Content>
                  <Item.Image src='https://firebasestorage.googleapis.com/v0/b/cs408e-http.appspot.com/o/firebase-step-6.png?alt=media&token=95097f34-7ea4-46ef-8b21-cfbbd6625fbb' />
                </Item>
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell collapsing>Firebase Admin SDK</Table.Cell>
              <Table.Cell>
                <Form>
                  <TextArea
                    autoHeight
                    placeholder={this.placeholder.firebaseAdminSDK}
                    value={firebaseAdminSDK}
                    onChange={e => this.setState({ firebaseAdminSDK: e.target.value })}
                    ref={n => this.ref.firebaseAdminSDK = n}
                  />
                </Form>
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell collapsing />
              <Table.Cell>
                <Item>
                  <Item.Content>
                    <Item.Description>7. Enable database usage.</Item.Description>
                  </Item.Content>
                  <Item.Image src='https://firebasestorage.googleapis.com/v0/b/cs408e-http.appspot.com/o/firebase-step-71.png?alt=media&token=59bb62a6-6d8d-4a69-a903-e9042d713615' />
                  <Item.Image src='https://firebasestorage.googleapis.com/v0/b/cs408e-http.appspot.com/o/firebase-step-72.png?alt=media&token=b54ac062-d056-415f-9c3a-58b2240de653' />
                  <Item.Image src='https://firebasestorage.googleapis.com/v0/b/cs408e-http.appspot.com/o/firebase-step-73.png?alt=media&token=4dfc883b-547d-425a-bc6c-9152430598d6' />
                </Item>
                <Item>
                  <Item.Content>
                    <Item.Description>8. Add a database index.</Item.Description>
                  </Item.Content>
                  <Item.Image src='https://firebasestorage.googleapis.com/v0/b/cs408e-http.appspot.com/o/firebase-step-81.png?alt=media&token=a9fee38e-95f1-406c-b506-6863421d3fa3' />
                  <Item.Image src='https://firebasestorage.googleapis.com/v0/b/cs408e-http.appspot.com/o/firebase-step-82.png?alt=media&token=9f49b7dd-0011-484f-b9b6-db06b4ffd1eb' />
                  <Item.Image src='https://firebasestorage.googleapis.com/v0/b/cs408e-http.appspot.com/o/firebase-step-83.png?alt=media&token=582817c0-fda9-48c5-a76f-4a68836d591d' />
                </Item>
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
      );
      case 5: return(
        <Segment id="ctf-summary">
          <Table celled selectable>
            <Table.Body>
              <Table.Row>
                <Table.Cell singleLine>Name of your CTF</Table.Cell>
                <Table.Cell>{ name }</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell singleLine>Memory quota</Table.Cell>
                <Table.Cell>{ memory } GB</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell singleLine>Core quota</Table.Cell>
                <Table.Cell>{ core } cores</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell singleLine>Total number of rounds</Table.Cell>
                <Table.Cell>{ nRound } rounds</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell singleLine>Time for each round</Table.Cell>
                <Table.Cell>{ nRoundTick } seconds</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell singleLine>API secret</Table.Cell>
                <Table.Cell>{ apiSecret }</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell singleLine>Mysql password</Table.Cell>
                <Table.Cell>{ mysqlPassword }</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell singleLine>Docker registry password</Table.Cell>
                <Table.Cell>{ dockerRegistryPassword }</Table.Cell>
              </Table.Row>

              <Table.Row><Table.Cell style={{ padding: 0}}><Divider /></Table.Cell><Table.Cell style={{ padding: 0}}><Divider /></Table.Cell></Table.Row>

              {
                teams.map((team, i) => (
                  <Table.Row key={i}>
                    <Table.Cell>{ `Team #${i + 1}` }</Table.Cell>
                    <Table.Cell>{ team.id } / { team.password }</Table.Cell>
                  </Table.Row>
                ))
              }

              <Table.Row><Table.Cell style={{ padding: 0}}><Divider /></Table.Cell><Table.Cell style={{ padding: 0}}><Divider /></Table.Cell></Table.Row>

              {
                services.map((service, i) => (
                  <Table.Row key={i}>
                    <Table.Cell>{ `Service #${i + 1}` }</Table.Cell>
                    <Table.Cell>{ service }</Table.Cell>
                  </Table.Row>
                ))
              }

              <Table.Row><Table.Cell style={{ padding: 0}}><Divider /></Table.Cell><Table.Cell style={{ padding: 0}}><Divider /></Table.Cell></Table.Row>

              <Table.Row>
                <Table.Cell singleLine>Firebase Configuration</Table.Cell>
                <Table.Cell id="summary-firebase-config" className="firebase-config">{ firebaseConfig }</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell singleLine>Firebase Admin SDK</Table.Cell>
                <Table.Cell id="summary-firebase-admin-sdk" className="firebase-config">{ firebaseAdminSDK }</Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table>
        </Segment>
      )
      default:
        return new Error("Unknown step: ", step)
    }
  }

  render() {
    const { step } = this.state;

    return (
      <div style={{ fontFamily: 'Lato' }}>
        <Step.Group ordered widths={5}>
          <Step active={step === 1} disabled={step < 1} completed={step > 1}>
            <Step.Content>
              <Step.Title>CTF</Step.Title>
              <Step.Description>Overall settings for your CTF</Step.Description>
            </Step.Content>
          </Step>
          <Step active={step === 2} disabled={step < 2} completed={step > 2}>
            <Step.Content>
              <Step.Title>Teams</Step.Title>
              <Step.Description>Form teams</Step.Description>
            </Step.Content>
          </Step>
          <Step active={step === 3} disabled={step < 3} completed={step > 3}>
            <Step.Content>
              <Step.Title>Services</Step.Title>
              <Step.Description>Manage services</Step.Description>
            </Step.Content>
          </Step>
          <Step active={step === 4} disabled={step < 4} completed={step > 4}>
            <Step.Content>
              <Step.Title>Dashboard</Step.Title>
              <Step.Description>Configure firebase settings</Step.Description>
            </Step.Content>
          </Step>
          <Step active={step === 5} disabled={step < 5} completed={step > 5}>
            <Step.Content>
              <Step.Title>Summary</Step.Title>
              <Step.Description>Summary for your CTF</Step.Description>
            </Step.Content>
          </Step>
        </Step.Group>

        <Segment attached style={{ fontSize: '16px', fontWeight: 'bold' }}>
          <Container>
            { this.renderStep() }
          </Container>
        </Segment>
        <Segment className='btns' attached>
          {
            step > 1 ? (
              <Button
                content='Prev'
                icon='left arrow'
                labelPosition='left'
                color={step > 1 ? 'green' : null}
                onClick={step > 1 ? () => this.setState({ step: step - 1 }, () => window.scrollTo(0, 0)) : null}
              />
            ) : <div />
          }
          {
            step < 5 ? (
              <Button
                content='Next'
                icon='right arrow'
                labelPosition='right'
                color={step < 5 ? 'green' : null}
                onClick={step < 5 ? () => this.setState({ step: step + 1 }, () => window.scrollTo(0, 0)) : null}
              />
            ) : (
              <div>
                <Button
                  content='Download summary as pdf'
                  color='black'
                  onClick={this.printSummary}
                />
                <Button
                  content='Configure'
                  color='blue'
                  onClick={this.configure.bind(this)}
                />
              </div>
            )
          }
        </Segment>
      </div>
    );
  }
}

export default App;
