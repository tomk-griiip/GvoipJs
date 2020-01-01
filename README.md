# GvoipJs
## libary to create voip call over WebRTC with raspbary pi machins and comunication withe the griiip signaling server 
You need to make sure there are 2 files Gvoip.js and streamvisualizer.js

1. init Gvoip object (the first thing that need to do )
```javascript
const loginSuccess = function(){
    loginPage.style.display = "none";
    callPage.style.display = "block";
};
const loginError = function(){
    alert("Ooops...try a different username");
}


/**
 *
 * @param host signaling server url (websocket wss)
 * @param remoteAudio the audio element that paly the remote track
 * @param loginSuccessCallback function to handle successful login to the signaling server
 * @param loginErrorCallback function to handle unsuccessfully login to the signaling server
 * @param loader (Optional) default undefined 
 * @param toVisualize (Optional) default True to show audio visualizeition
 * @constructor of Gvoip object
 */
let gvoip = new Gvoip(host, remoteAudio, loginSuccess, loginError, new loaderObj(loader),true);
```
2. log in the user to the signaling server 
```javascript
let loginBtn = document.querySelector('#loginBtn'),
    usernameInput = document.querySelector('#usernameInput');
// Login when the user clicks the button
loginBtn.addEventListener("click", function (event) {
    myName = usernameInput.value;

    if (myName.length > 0) {
      //login to the signaling server
        gvoip.loginToSignalingServer(myName);
    }

});    
```

3. create and hungup the P2P call (need to pass the client name that whant to call to )

```javascript
let callToUsernameInput = document.querySelector('#callToUsernameInput'),//drope dwone list with a list of the loged in users
    hangUpBtn = document.querySelector('#hangUpBtn'),//butoon to hungup the call
    callBtn = document.querySelector('#callBtn');//butoon to astablish the call
callBtn.addEventListener("click", ()=>{
    if(callToUsernameInput.value === '{}'){
        alert('plies select a user from the list');
        return;
    }
    let callToUsername = callToUsernameInput.value;
    //if there is no user to connect to return and do nothing
    if(callToUsername <= 0)
        return;
    //if there is users to connect to
    connectedUser = callToUsername;
    //start P2P negotiation phase
    gvoip.startNegotiate(connectedUser);
});

hangUpBtn.addEventListener("click", ()=>{
    //close the P2P conaction to the client 
    gvoip.handle_leave()
});
```

4. when a user loged in to the signaling server Gvoip know to listen to the login event from the signaling server and dispatch event 
on the window object level , with all the loged in users incloud the new one.
to be able to use this event and to reload the avilable user list one need to implimant a listener to the 'UsersChange' event 
and process the new users like the exemple below that rerander and reorginaize a Drop Dwon List with the new list

```javascript
let callToUsernameInput = document.querySelector('#callToUsernameInput');
//handler function for the 'userChange' event
function handleAddUser(users) {
    let selectLength = callToUsernameInput.length;
    for (let i = 1 ; i < selectLength; i++){
        callToUsernameInput.options[i] = null; //reset the list to be empty
    }
    users.forEach((item)=>{//itarte over the user list from the UsersChange event
        if(item != myName){
            //add each user as option elment in the Drop Dwon List
            let option = document.createElement( 'option' );
            option.value = option.textContent = item;
            callToUsernameInput.append(option);
        }
    });
}

//add the global window object as listener to the 'UserChange' event
window.addEventListener('UsersChange', function(e){
  //e.data  = the new user list from the signaling server
    handleAddUser(e.data);
})
```

## extra options

i. Gvoip have the ability to visualize the remote audio from the remot peer client
by adding true to the last argument of the constructor and add <canvas> elmenet to the HTML DOM 
like this 
```javascript
//the true at the end tell Gvoip to show remote audio on the canvas that in the   DOM
let gvoip = new Gvoip(host, remoteAudio, loginSuccess, loginError, new loaderObj(loader),true);
```
```html
<!-- canvas whit light black color that the visualize will be drow on -->
 <canvas"style="background-color: #000000c4;"></canvas>
```

ii. Establishing a P2P call can take time( few secoonds or soo) sthats way Gvoip have an interface to create loader 
Gvoip will automatically start and stop loader if a proer implantation of the interface will be pass in the Gvoip constructor 
for using the loader option need to rap the html/css loader in javascript object that have tow methode's start and stop like this:
```html
<!--exemple of loader div -->
<div class="lds-ripple" id = "loader"><div>
```
```javascript
//select the loader elment
let loader = document.querySelector('#loader'),
    loaderObj = function(loader){ //create js object that controll the loader html elment and have stop and start functions !!!
        this.loader = loader;
        this.start = function(){//function to show the loader
            this.loader.style.visibility = "visible";
        }
        this.stop = function(){//function to hide the loader
            this.loader.style.visibility = "hidden";
        }
    };
```
```javascript
//loaderObj is an object that controll the html loader and we pass it to the Gviop object
let gvoip = new Gvoip(host, remoteAudio, loginSuccess, loginError, new loaderObj(loader),true);
```
!!! its o.k to not use the loader option and to not pass one
but if a loader has passed to the constructor it's must implantat start and stop otherwise loader will not show on the screen  
and a wrning will be print to the browser console 


## bluetooth support

for control the bluetooth on the raspberry pi need to :
1. chose the relevant raspberry pi device so Gvoip will have that user as connected user then :
inside Gvoip there is anther object Bluetooth (there is no need to init that object !!!)
set the relevnt raspberry pi device to connect to 
```javascript
    gv.Bluetooth.setConnectTo({the raspberry pi user chose from the list})
```

(i). call function Bluetooth.startScan() to start the scan

```javascript
    scanBtn = document.querySelector('#scanBtn')
    scanBtn.addEventListener("click", ()=>{
        gv.Bluetooth.startScan()
    });

``` 

(ii) add window event listener (deviceFound) to execute when the raspberry pi send new founded device

```javascript
let deviceName = null, deviceAddress = null;
window.addEventListener('deviceFound', function(e){
    //e.data.address = new device address
    // e.data.name = new device name;
    deviceName = e.data.name; 
    deviceAddress = e.data.address
});
``` 
(iii) in order to connect to the device need to call 
Bluetooth.connect({device name}, {device address});
```javascript
 gv.Bluetooth.connect(deviceName, deviceAddress);
```
(iv) when the raspberry pi finish to connect new event will throw named   bluetoothStatusChange
with device address name and state (connected or failed )

```javascript
window.addEventListener('bluetoothStatusChange', function(e){

   alert(`${e.data.address} - ${e.data.name} - ${e.data.state}`);
    console.log('from bluetoothStatusChange event listener: ', e.data);

});
```
if state is connected bluetooth device connected successfully 
