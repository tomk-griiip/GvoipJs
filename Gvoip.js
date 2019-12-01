/*Griiip Voip WebRtc API Library*/

(function (global) {
    'use strict';

    /*private function*/
    let _wsOnmessage = function(msg){
        console.log("Got message", msg.data);
        let data = JSON.parse(msg.data),
            handlerName = "handle_" + data.type;
        this[handlerName](data);
    }
    // start socket listening
    let _startWebsocket = function(){
        this.ws = new WebSocket(this.host);
        this.ws.addEventListener('message', _wsOnmessage.bind(this));
        this.ws.addEventListener('close', _startWebsocket.bind(this));
    }

    //create webRtc peer connection
    function createPeerConnection(remoteAudio) {
        //create config for the peer connection
        let config = {
            sdpSemantics: 'unified-plan'
        };
        config.iceServers= [{ "url": "stun:stun.l.google.com:19302" }];
        this.pc = new RTCPeerConnection(config);
        // register track listeners to play remote track
        this.pc.addEventListener('track', function(e) {
            this.getRemoteAudio().srcObject  = e.streams[0];//.src = window.URL.createObjectURL(e.stream);
            this.getRemoteAudio().play();
            //const streamVisualizerRemote = new StreamVisualizer(e.streams[0], remoteCanvas);
            //streamVisualizerRemote.start();
        });
        // register some listeners to help debugging
        this.pc.addEventListener('icegatheringstatechange', function () {
            console.log(' icegatheringstatechange-> ' + this.pc.iceGatheringState);
        }, false);


        this.pc.addEventListener('iceconnectionstatechange', function () {
            console.log('iceconnectionstatechange -> ' + this.pc.iceConnectionState);
        }, false);


        this.pc.addEventListener('signalingstatechange', function () {
            console.log(' signalingstatechange -> ' + this.pc.signalingState);
        }, false);


        this.pc.addEventListener('connectionstatechange', function () {
            console.log("conaction state changed : " + this.pc.connectionState)
        });
        return this.pc //return peer connection
    }

    function negotiate(_pc){

        return new Promise((resolve,reject)=>{
            _pc = createPeerConnection.bind(this)();//create peer

            //get browser media (only audio)
            navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then((stream) =>{
                //const streamVisualizerLocal = new StreamVisualizer(stream, localCanvas);
                //streamVisualizerLocal.start();
                stream.getTracks().forEach(function(track) {
                    //if(pc.signalingState != "closed")
                    _pc.addTrack(track, stream);
                    resolve(_pc);
                });
            }).catch((e)=>{

                reject(e);
            })
        })
    };//startNegotiate

    //contractor function
    global.Gvoip = function(host, remoteAudio, loginSuccessCallback, loginErrorCallback) {

        /*private properties*/
        let _remoteAudio = remoteAudio,
            _stream,
            _connectedUser = null,
            _connectedUsers = [],
            _self = this;

        /*public properties*/
        this.ws = null, this.host = host, this.pc = null, this.myName = null, this.loginSuccessCallback = loginSuccessCallback,
            this.loginErrorCallback = loginErrorCallback;

        this.getSelf = function(){return _self};//getter this

        this.setConnectedUser = function(user){_connectedUser = user};//setter connectedUser

        this.getConnectedUser = function(){return _connectedUser};//getter connectedUser

        this.setRemoteAudio = function(remoteAudio){_remoteAudio.src = remoteAudio};//setter remoteAudio

        this.getRemoteAudio = function(){return _remoteAudio};//getter remoteAudio

        this.setConnectedUsers = function(users){ _connectedUsers = users;};//setter connectedUsers

        this.getConnectedUsers = function(){return _connectedUsers};//getter connectedUsers

        _startWebsocket.bind(_self)();
    };
    /*public function*/

    //alias for sending JSON encoded messages
    Gvoip.prototype.send = function(message) {
        //attach the other peer username to our messages
        let connectedUser = this.getConnectedUser();
        if (connectedUser) {
            message.name = connectedUser;
        }
        this.ws.send(JSON.stringify(message));
    };

    //login to the signaling server
    Gvoip.prototype.loginToSignalingServer = function(userName){
        if (userName.length > 0) {
            this.myName = userName;
            this.send({
                type: "login",
                name: userName
            });
        }
    }//loginToSignalingServer

    //start negotiation phase
    Gvoip.prototype.startNegotiate = function(user){

        if(user <= 0 || user === undefined || user == null || user === '') {
            alert('plies select a user from the list');
            return null;
        }
        this.setConnectedUser(user);
        //start negotiation and after create offer
        negotiate.bind(this)(this.pc).then((_pc)=>_pc.createOffer().then((offer) => {
            let _offer = offer;
            console.log('_pc : '+_pc);
            __pc.setLocalDescription(offer);


            //.then(() => send({type: "offer", offer: _offer}));

        }).then(()=>{
            // wait for ICE gathering to complete before sending the offer
            return new Promise((resolve)=>{
                if (_this.pc.iceGatheringState === 'complete') {
                    resolve();
                }else{
                    function checkState() {
                        if (_this.pc.iceGatheringState === 'complete') {
                            _this.pc.removeEventListener('icegatheringstatechange', checkState);
                            //loader.style.visibility = "hidden";
                            resolve();
                        }
                    }
                }
                this.pc.addEventListener('icegatheringstatechange', checkState);
            })
        }).then(() =>{//after ICE gathering complete send the offer with the ICE candidate
            _this.send({type: "offer", offer: this.pc.localDescription})
        }).catch((error) => {//error handler
            console.log(`creating offer error : ${error}`);
            alert(`Error : ${error}`);
        }));//createOffer

    };//startNegotiate

    //handle Login massage from signaling server
    Gvoip.prototype.handle_login = function(data){

        if(data.success === false)
            this.loginErrorCallback()
        else
            this.loginSuccessCallback();
    }

    //handler when user logout the VOIP system
    Gvoip.prototype.handle_leave = function(data){

        this.pc.getSenders().forEach(function(sender) {
            sender.track.stop();
        });

        this.setRemoteAudio(null)
        this.setConnectedUser(null);

        setTimeout(()=>{
            this.pc.close();
            this.send({type: "leave",name:this.name});
        },500)
    };//handleLeave

    //when somebody sends us an offer
    Gvoip.prototype.handle_offer = function(data){
        let offer = data.offer, name = data.name;

        this.setConnectedUser(name);

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

    //when we got an answer from a remote user
    Gvoip.prototype.handle_answer = async function(data) {

        await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    }//handleAnswer

    //when we got an ice candidate from a remote user
    Gvoip.prototype.handle_candidate = function(data){
        this.pc.addIceCandidate(new RTCIceCandidate(data.candidate)).then(()=>{
            console.log('success to add ice candidate : ');
        }).catch((e)=>{
            console.error(`add ice candidate error : ${e}`);
            console.error(`add ice candidate message : ${e.message}`);
        });
    }//handleCandidate

    //when user is login/logout to the signaling server
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