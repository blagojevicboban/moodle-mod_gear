// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Collaborative mode of the GEAR viewer: shared session, avatars and WebRTC voice and text chat.
 *
 * @module     mod_gear/sync
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import * as THREE from 'three';
import Ajax from 'core/ajax';
import Notification from 'core/notification';
import Str from 'core/str';

/* global Peer */

/**
 * SyncManager class for collaborative mode & WebRTC.
 */
export default class SyncManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.interval = null;
        this.avatars = {}; // Map of userid -> { mesh }
        this.lastPosition = null;
        this.lastRotation = null;

        // WebRTC
        this.peer = null;
        this.localStream = null;
        this.calls = {}; // PeerId -> call
        this.dataConns = {}; // PeerId -> dataConn
        this.voiceEnabled = false;

        // Random id of this browser session. The server lists the participants and only those peers are accepted.
        var bytes = new Uint8Array(12);
        window.crypto.getRandomValues(bytes);
        this.peerId = 'gear' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        this.known = {}; // PeerId -> userid of the current participants.
    }

    /**
     * Whether a peer is a participant of this session. Unknown peers get one fresh look at the session list.
     *
     * @param {string} peerId Peer id
     * @returns {Promise<boolean>}
     */
    async acceptPeer(peerId) {
        if (this.known[peerId]) {
            return true;
        }
        await this.sync();
        return !!this.known[peerId];
    }

    initPeer() {
        if (!this.peerPromise) {
            this.peerPromise = this.createPeer();
        }
        return this.peerPromise;
    }

    async createPeer() {
        if (this.peer) {
            return;
        }
        try {
            await this.loadPeerJs();
        } catch (e) {
            this.peerPromise = null;
            return;
        }
        this.peer = new Peer(this.peerId, this.viewer.peerServer || {});

        this.peer.on('call', async(call) => {
            if (!await this.acceptPeer(call.peer)) {
                call.close();
                return;
            }
            if (this.localStream) {
                call.answer(this.localStream);
            } else {
                call.answer(); // Empty stream
            }
            this.handleCall(call);
        });

        this.peer.on('connection', async(conn) => {
            if (!await this.acceptPeer(conn.peer)) {
                conn.close();
                return;
            }
            this.handleDataConnection(conn);
        });
    }

    /**
     * Load the self-hosted PeerJS script on first use (it is only needed when several people share a session).
     *
     * @returns {Promise<void>}
     */
    loadPeerJs() {
        if (typeof Peer !== 'undefined') {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            var script = document.createElement('script');
            script.src = this.viewer.peerjsUrl;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('PeerJS failed to load'));
            document.head.appendChild(script);
        });
    }

    async joinVoiceChat() {
        if (this.voiceEnabled) {
 return;
}
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({audio: true, video: false});
            this.voiceEnabled = true;

            if (!this.peer) {
                await this.initPeer();
            }

            var btn = document.getElementById('gear-voice-btn-' + this.viewer.cmid);
            if (btn) {
                btn.querySelector('i').className = 'fa fa-microphone text-success';
            }

            Notification.addNotification({message: await Str.get_string('voicejoined', 'mod_gear'), type: 'success'});
        } catch (e) {
            Notification.alert(await Str.get_string('error', 'core'), await Str.get_string('voicenotsupported', 'mod_gear'));
        }
    }

    handleCall(call) {
        call.on('stream', (remoteStream) => {
            var peerUserId = this.known[call.peer];

            var avatar = this.avatars[peerUserId];
            // Only attach if avatar exists and doesn't already have audio
            if (avatar && !avatar.hasAudio) {
                var sound = new THREE.PositionalAudio(this.viewer.audioListener);
                // R128 PositionalAudio supports setMediaStreamSource
                if (typeof sound.setMediaStreamSource === 'function') {
                    sound.setMediaStreamSource(remoteStream);
                } else {
                    // Fallback
                    sound.setNodeSource(sound.context.createMediaStreamSource(remoteStream));
                }
                sound.setRefDistance(2);
                avatar.mesh.add(sound);
                avatar.hasAudio = true;
            }
        });
        this.calls[call.peer] = call;
    }

    handleDataConnection(conn) {
        conn.on('open', () => {
            this.dataConns[conn.peer] = conn;
        });
        conn.on('data', async(data) => {
            if (!data || typeof data.text !== 'string') {
                return;
            }
            const sender = await Str.get_string('chatuser', 'mod_gear', this.known[conn.peer] || '?');
            this.displayChatMessage(sender, data.text.substring(0, 500), 'other');
        });
        conn.on('close', () => {
            delete this.dataConns[conn.peer];
        });
    }

    connectData(peerId) {
        if (this.dataConns[peerId]) {
 return;
}
        var conn = this.peer.connect(peerId);
        this.handleDataConnection(conn);
    }

    sendChatMessage(text) {
        var msg = {text: text};
        Object.values(this.dataConns).forEach(conn => {
            if (conn.open) {
                conn.send(msg);
            }
        });
        Str.get_string('chatme', 'mod_gear').then((me) => this.displayChatMessage(me, text, 'self')).catch(Notification.exception);
    }

    displayChatMessage(sender, text, type) {
        var messagesDiv = document.getElementById('gear-chat-messages-' + this.viewer.cmid);
        if (!messagesDiv) {
 return;
}
        var msgDiv = document.createElement('div');
        msgDiv.className = 'gear-chat-msg ' + type;
        var senderSpan = document.createElement('span');
        senderSpan.className = 'gear-chat-sender';
        senderSpan.textContent = String(sender);
        msgDiv.appendChild(senderSpan);
        msgDiv.appendChild(document.createTextNode(String(text)));
        messagesDiv.appendChild(msgDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    start() {
        this.interval = setInterval(() => {
            if (!document.hidden) {
                this.sync();
            }
        }, 2000);
        this.sync(); // Initial call
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    sync() {
        if (!this.viewer.camera) {
            return Promise.resolve();
        }

        // Use Three.js properties.
        var pos = this.viewer.camera.position;
        var rot = this.viewer.camera.rotation;

        // Only update if changed significantly?
        // For now, send anyway to keep session alive (heartbeat).

        var posObj = {x: pos.x, y: pos.y, z: pos.z};
        var rotObj = {x: rot.x, y: rot.y, z: rot.z}; // Euler

        return Ajax.call([{
            methodname: 'mod_gear_sync_session',
            args: {
                gearid: this.viewer.gearid,
                position: JSON.stringify(posObj),
                rotation: JSON.stringify(rotObj),
                peerid: this.peerId
            }
        }])[0].then((users) => {
            this.updateAvatars(users);
            return users;
        }).catch((e) => {
            window.console.warn('Sync error', e);
        });
    }

    updateAvatars(users) {
        var activeIds = new Set();

        this.known = {};
        users.forEach((user) => {
            activeIds.add(user.userid);
            if (user.peerid) {
                this.known[user.peerid] = user.userid;
            }

            if (!this.avatars[user.userid]) {
                this.createAvatar(user);
            }

            this.updateAvatarState(user);
        });

        // Remove disconnected users.
        Object.keys(this.avatars).forEach((id) => {
            if (!activeIds.has(parseInt(id))) {
                this.removeAvatar(id);
            }
        });

        // Close calls and chat connections of peers that left the session.
        [this.calls, this.dataConns].forEach((map) => {
            Object.keys(map).forEach((peerId) => {
                if (!this.known[peerId]) {
                    if (map[peerId] && map[peerId].close) {
                        map[peerId].close();
                    }
                    delete map[peerId];
                }
            });
        });

        // PeerJS is only needed when somebody else is in the session.
        if (!this.peer && users.some((user) => user.userid != this.viewer.userid)) {
            this.initPeer();
        }

        // Connect uncalled voice peers
        if (this.peer) {
            users.forEach((user) => {
                if (user.userid != this.viewer.userid && user.peerid) {
                    var pId = user.peerid;
                    if (this.voiceEnabled && !this.calls[pId]) {
                        var call = this.peer.call(pId, this.localStream);
                        if (call) {
                            this.handleCall(call);
                        } else {
                            this.calls[pId] = null;
                        }
                    }
                    // Connect text chat
                    if (!this.dataConns[pId]) {
                        this.connectData(pId);
                    }
                }
            });
        }
    }

    createAvatar(user) {
        // Create a group for the avatar.
        var group = new THREE.Group();

        // Simple avatar: Sphere representing head.
        var geometry = new THREE.SphereGeometry(0.3, 16, 16);
        var color = '#' + Math.floor(Math.random() * 16777215).toString(16);
        var material = new THREE.MeshBasicMaterial({color: color});
        var sphere = new THREE.Mesh(geometry, material);
        group.add(sphere);

        // Add to scene.
        this.viewer.scene.add(group);

        this.avatars[user.userid] = {
            mesh: group
        };
    }

    updateAvatarState(user) {
        var avatar = this.avatars[user.userid];
        if (!avatar) {
 return;
}

        if (user.position) {
            try {
                var pos = (typeof user.position === 'string') ? JSON.parse(user.position) : user.position;
                avatar.mesh.position.set(pos.x, pos.y, pos.z);
            } catch (e) {
                // Ignore parse error
            }
        }

        if (user.rotation) {
             try {
                var rot = (typeof user.rotation === 'string') ? JSON.parse(user.rotation) : user.rotation;
                avatar.mesh.rotation.set(rot.x, rot.y, rot.z);
            } catch (e) {
                // Ignore parse error
            }
        }
    }

    removeAvatar(userid) {
        var avatar = this.avatars[userid];
        if (avatar && avatar.mesh) {
            this.viewer.scene.remove(avatar.mesh);
            // Optional: dispose geometry/material.
        }
        delete this.avatars[userid];
    }
}
