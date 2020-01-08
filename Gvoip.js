/*Griiip Voip WebRtc API Library*/
/**
 * @type Griiip Voip WebRtc API Library
 * @author Tom Knobel
 * @created-dte 01/12/2019
 */
import('./streamvisualizer.js').then(module=>{
    StreamVisualizer = module.StreamVisualizer;
});
(function (global) {
    'use strict';

    /**
     * interface for loader
     * @param loader
     * @constructor
     */

    let BluetoothCls = function(_that){

        this._that = _that
    }

    BluetoothCls.prototype.setConnectTo = function(user){
        if(! user )
            return new Error('cant set user undefined')
        if(! this._that.myName)
            return new Error('user must be loged in to signaling server in order to set blutoot')
        this._that.setConnectedUser(user)
        this._that.send({type: "bluetooth_login", data: this._that.myName})
    }

    BluetoothCls.prototype.startScan = function(){
        this._that.send({type: "bluetooth_scan", data:true})
    }

    BluetoothCls.prototype.connect = function(deviceName, deviceAddress){
        this._that.send({type: "bluetooth_connect", data:{name:deviceName, address:deviceAddress}});

    }

    BluetoothCls.prototype.handle_bluetooth_scan = function(msg){
        let event = new CustomEvent('deviceFound',{detail:{}},true,true);//document.create('UsersChange');
        event.data = msg.data;
        window.dispatchEvent(event)
    }
    BluetoothCls.prototype.handle_bluetooth_status = function(msg){
        let event = new CustomEvent('bluetoothStatusChange',{detail:{}},true,true);//document.create('UsersChange');
        event.data = msg.data;
        window.dispatchEvent(event)
    }
    let global_to_visualize = false;
    let ILoader = function(loader){
        /**
         *
         * @param _interface to comparer with
         * @param obj to check
         * @returns {boolean} if the obj is instance of _interface
         */
        let methods = function (_interface, obj){
            for(let item of Object.getOwnPropertyNames(_interface)){
                if (item == 'constructor')
                    continue;
                else
                if(!(typeof _interface[item] === 'function' && typeof obj[item] === 'function'))
                    return false
            }//for
            return true;
        }//methods

        /**
         * check if  loader object is instance of ILoader
         * @param loader
         * @returns {boolean} true if the loader obj that passed to constructor is implements stop and start
         */
        function checkLoader(loader) {
            let isLoader =  methods(ILoader.prototype, loader);
            if(!isLoader){
                console.warn("loader object must implement's start and stop method's or be undefined")
            }
            return isLoader;
        }//checkLoader

        if(loader !== undefined && checkLoader(loader))
            return loader;
        else
            return this; //init ILoader
    }//ILoader


    /**
     * abstract start method
     * @returns {boolean}
     */
    ILoader.prototype.start = function(){
        return true;
    }
    /**
     * abstract stop method
     * @returns {boolean}
     */
    ILoader.prototype.stop = function(){
        return true;
    }

    /*private function's*/
    /**
     *
     * @param msg the message that the web socket send to this client
     * @private
     * @description thus function get message from the connected server and pass it to the relevant function
     * the handler function need to be call "handle_{message type}" like handle_login
     */
    let _wsOnmessage = function(msg){
        console.log("Got message", msg.data);
        let data = JSON.parse(msg.data),
            handlerName = "handle_" + data.type;
        try {
            this[handlerName](data);
        }catch (e) {
            this.Bluetooth[handlerName](data)
        }
    }
    /**
     *
     * @private
     * @description start listening to the server according to the host url passed to the constructor
     */
    let _startWebsocket = function(){
        this.ws = new WebSocket(this.host);
        this.ws.addEventListener('message', _wsOnmessage.bind(this));
        this.ws.addEventListener('close', _startWebsocket.bind(this));
    }

    /**
     *
     * @param remoteAudio the audio element that play the sound on the UI
     * @returns {RTCPeerConnection} a connection to the client
     * @description create javascript RTCPeerConnection object that connect to the relevant client
     */
    function createPeerConnection(remoteAudio) {
        //create config for the peer connection
        let config = {
            sdpSemantics: 'unified-plan'
        };
        config.iceServers= [{ "url": "stun:stun.l.google.com:19302" }];//ice/stun servers
        this.pc = new RTCPeerConnection(config);
        /**
         * register RTCPeerConnection events to listen to
         */
        //event for when remote track is received
        this.pc.addEventListener('track', function(e) {
            remoteAudio.srcObject  = e.streams[0];//.src = window.URL.createObjectURL(e.stream);
            remoteAudio.play();
            if(global_to_visualize) {
                const streamVisualizerRemote = new StreamVisualizer(e.streams[0], document.querySelector('canvas'));
                streamVisualizerRemote.start();
            }
        });
        //event when the ice gathering state is change
        this.pc.addEventListener('icegatheringstatechange', function () {
            console.log(' icegatheringstatechange-> ' + this.iceGatheringState);
        }, false);

        //event when the ice connection state is change
        this.pc.addEventListener('iceconnectionstatechange', function () {
            console.log('iceconnectionstatechange -> ' + this.iceConnectionState);
        }, false);

        //event when the signaling state change
        this.pc.addEventListener('signalingstatechange', function () {
            console.log(' signalingstatechange -> ' + this.signalingState);
        }, false);

        //event when the connection state is change
        this.pc.addEventListener('connectionstatechange', function () {
            console.log("conaction state changed : " + this.connectionState)
        });
        return this.pc //return javascript RTCPeerConnection object
    }

    /**
     *
     * @param _pc the RTCPeerConnection that was created in the createPeerConnection function
     * @returns {Promise<resolve,reject>} inside the resolve there is the RTCPeerConnection
     */
    function negotiate(_pc, __loader){
        return new Promise((resolve,reject)=>{
            __loader.start();
            _pc = createPeerConnection.bind(this)(this.getRemoteAudio());//create RTCPeerConnection

            //get browser media (only audio)
            navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then((stream) =>{//gating the browser media API and access
                //const streamVisualizerLocal = new StreamVisualizer(stream, localCanvas);
                //streamVisualizerLocal.start();
                stream.getTracks().forEach(function(track) {//add the local audio track to the RTCPeerConnection to be able to send it to the peer client
                    //if(pc.signalingState != "closed")
                    _pc.addTrack(track, stream);
                    resolve([_pc, __loader]);
                });
            }).catch((e)=>{

                reject(e);
            })
        })
    };//startNegotiate
    /**
     *
     * @param host signaling server url (websocket wss)
     * @param remoteAudio the audio element that paly the remote track
     * @param loginSuccessCallback function to handle successful login to the signaling server
     * @param loginErrorCallback function to handle unsuccessfully login to the signaling server
     * @param loader default undefined
     * @param toVisualize default True
     * @constructor of Gvoip object
     */
    global.Gvoip = function(host, remoteAudio, loginSuccessCallback, loginErrorCallback, loader = undefined, toVisualize = false) {
        /**
         * private properties
         */
        global_to_visualize = toVisualize;
        let _remoteAudio = remoteAudio,
            _stream,
            _connectedUser = null,
            _connectedUsers = [],
            _self = this;

        /**
         * public properties
         */
        this.ws = null, this.host = host, this.pc = null, this.myName = null, this.loginSuccessCallback = loginSuccessCallback,
            this.loginErrorCallback = loginErrorCallback, this.loader = new ILoader(loader), this.Bluetooth =  new BluetoothCls(this);

        /**
         *
         * @returns {global.Gvoip}
         */
        this.getSelf = function(){return _self};//getter this

        /**
         * set connectedUser
         * @param user
         */
        this.setConnectedUser = function(user){_connectedUser = user};//setter connectedUser

        /**
         * get connectedUser
         * @returns {connectedUser}
         */
        this.getConnectedUser = function(){return _connectedUser};//getter connectedUser

        /**
         * set remoteAudio
         * @param remoteAudio
         */
        this.setRemoteAudio = function(remoteAudio){_remoteAudio.src = remoteAudio};//setter remoteAudio

        /**
         * get the remoteAudio object
         * @returns HTML audio element
         */
        this.getRemoteAudio = function(){return _remoteAudio};//getter remoteAudio

        /**
         * set the connectedUsers of the signal server
         * @param users
         */
        this.setConnectedUsers = function(users){ _connectedUsers = users;};//setter connectedUsers

        /**
         * get the connectedUsers of the signal server
         * @returns {Array}
         */
        this.getConnectedUsers = function(){return _connectedUsers};//getter connectedUsers

        /**
         * tries to recall the user for timer seconds
         */
        this.reCall = function(timer, user) {
            console.log("In recall with user: ", user);
            setTimeout(function() {
                if (_self.getConnectedUsers().includes(user)) {
                    console.log(`Establishing connection with user ${user}`);
                    _self.startNegotiate(user);
                } else if (timer > 0) {
                    console.log(`user ${user} is offline`);
                    _self.reCall(--timer, user);
                }
            }, 1000);
        };
  
        /**
         * start listening  server web socket
         */
        _startWebsocket.bind(_self)();
    };
    /*public function*/
    /**
     *
     * @param message to send to signaling server over web socket
     */
    Gvoip.prototype.send = function(message) {
        //attach the other peer username to our messages
        let connectedUser = this.getConnectedUser();
        if (connectedUser) {
            message.name = connectedUser;
        }
        this.ws.send(JSON.stringify(message));
    };
    /**
     * login to the signaling server
     * @param userName
     */
    Gvoip.prototype.loginToSignalingServer = function(userName){
        if (userName.length > 0) {
            this.myName = userName;
            this.send({
                type: "login",
                name: userName
            });
        }
    }//loginToSignalingServer
    /**
     * start negotiation phase
     * @param user
     * @returns {null}
     */
    Gvoip.prototype.startNegotiate = function(user){

        if(user <= 0 || user === undefined || user == null || user === '') {
            alert('plies select a user from the list');
            return null;
        }
        this.setConnectedUser(user);
        //start negotiation and after create offer
        negotiate.bind(this)(this.pc, this.loader).then(([_pc,__loader])=>_pc.createOffer().then((offer) => {
            let _offer = offer;
            _pc.setLocalDescription(offer);
        }).then(()=>{
            // wait for ICE gathering to complete before sending the offer
            return new Promise((resolve)=>{
                if (_pc.iceGatheringState === 'complete') {
                    resolve();
                }else{
                    let _thatPromise = this;
                    this.checkState = function () {
                        if (_pc.iceGatheringState === 'complete') {
                            _pc.removeEventListener('icegatheringstatechange', _thatPromise.checkState);
                            __loader.stop();
                            resolve();
                        }
                    }
                }
                _pc.addEventListener('icegatheringstatechange', this.checkState);
            })
        }).then(() =>{//after ICE gathering complete send the offer with the ICE candidate
            this.send({type: "offer", offer: this.pc.localDescription})
        }).catch((error) => {//error handler
            console.log(`creating offer error : ${error}`);
            alert(`Error : ${error}`);
        }));//createOffer

    };//startNegotiate
    /**
     * handle Login massage from signaling server
     * @param data
     */
    Gvoip.prototype.handle_login = function(data){

        if(data.success === false)
            this.loginErrorCallback()
        else
            this.loginSuccessCallback();
    }
    /**
     * handler when user logout the VOIP system
     * @param data
     */
    Gvoip.prototype.handle_leave = function(data){

        this.pc.getSenders().forEach(function(sender) {
            sender.track.stop();
        });

        this.setRemoteAudio(null)

        setTimeout(()=>{
            this.pc.close();
            this.send({type: "leave"});
            this.setConnectedUser(null);
        },500)
        if (data.type === "leave") {
            var timer = 300; // indicates for how long the program need to try recalling the user
            var userToCall = this.getConnectedUser();
            console.log(`Lost connection with ${userToCall}, Trying to reconnect`);
            this.reCall(timer, userToCall);
        } // Call has been hungup NOT by user
    };//handleLeave
    /**
     * when somebody sends us an offer to connect throw p2p connection
     * @param data
     */
    Gvoip.prototype.handle_offer = function(data){
        let offer = data.offer, name = data.name;
        this.loader.stop();
        this.setConnectedUser(name);
        if(this.pc == null)
            this.pc = createPeerConnection.bind(this)(this.getRemoteAudio());

        this.pc.setRemoteDescription(new RTCSessionDescription(offer)).then(()=>{
            return this.pc.createAnswer()
        }).then((answer)=>{
            let _answer = answer;
            this.pc.setLocalDescription(answer).then(()=>this.send({type:"answer", answer: _answer}));
        }).catch((error)=>{
            alert(`creating answer error : ${error}`);
            console.log(`creating answer error : ${error}`);
        });
    }//handleOffer
    /**
     * when we got an answer from a remote client set a RTCSessionDescription
     * @param data
     * @returns {Promise<void>}
     * @async
     * @wait for setRemoteDescription
     */
    Gvoip.prototype.handle_answer = async function(data) {

        await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    }//handleAnswer
    /**
     * when we got an ice candidate from a remote user
     * @param data ( ice candidate )
     */
    Gvoip.prototype.handle_candidate = function(data){
        this.pc.addIceCandidate(new RTCIceCandidate(data.candidate)).then(()=>{
            console.log('success to add ice candidate : ');
        }).catch((e)=>{
            console.error(`add ice candidate error : ${e}`);
            console.error(`add ice candidate message : ${e.message}`);
        });
    }//handleCandidate
    /**
     * when user is login/logout to the signaling server update the connectedUsers
     * @param data  (all the connected users from the signaling server )
     * @dispatch dispatch UsersChange on the window object level window/or any other object need to listen for this event
     */
    Gvoip.prototype.handle_connectedUsers = function(data){
        let _users = this.getConnectedUsers(), users = data.data;
        _users.length = 0;
        _users = [];
        users.forEach((user)=>{
            if(_users.indexOf(user) < 0 && user != this.myName){
                _users.push(user);
            }
        });
        this.setConnectedUsers(_users);
        let event = new CustomEvent('UsersChange',{detail:{}},true,true);//document.create('UsersChange');
        event.data = _users;
        window.dispatchEvent(event)
    }//handleAddUser

})(this);