'use strict'
var airplayer = require('airplayer')
var list = airplayer()
var ytdl = require('ytdl-core')
var ytdlUtil = require('ytdl-core/lib/util')
var devices = []
var devices_data = {}
var intervals = []

exports.init = function(devices, callback) {
    // Homey.log('init', devices)
    devices.forEach(initDevice)
    discoverAirplay()
    callback()
}

exports.added = function(device_data, callback) {
    initDevice(device_data)
    callback(null, true)
}

exports.deleted = function(device_data, callback) {
    delete devices[device_data.id];

    Homey.log('Device deleted');
    callback(null, true);
}

exports.pair = function(socket) {
    socket.on('list_devices', function(data, callback) {
        callback(null, devices.map(function(airplay) {
            var name = airplay.name
            return {
                name: name,
                data: {
                    id: name
                }
            }
        }))
    })
}

function discoverAirplay(resetList) {

    list.on('update', function(device) {
            if (resetList) {
                devices.length = 0
                resetList = false
            }

            var models = ['Xbmc,1'];
            if (models.indexOf(device.model) > -1) {
                console.log('Kodi device found...')
                devices.push(device)
            }
            //devices.push(device)

            getDeviceData(device.name, function(device_data) {
                    exports.setAvailable(device_data)
                })
                // Homey.log('devices', devices)
        })
        // Homey.log('devices', devices)
    setTimeout(function() {
            for (var name in devices_data) {
                if (!getDeviceByName(name)) {
                    exports.setUnavailable(devices_data[name], 'Offline')
                }
            }
        }, 15000)
        // rediscover devices every 10 mins
    setTimeout(discoverAirplay, 600000, true)
}

exports.stopVideo = function(deviceName, callback) {
    getDevice(deviceName, function(device) {
        device.stop(function(err) {
            //console.log(err)
            callback(null, true)
        })
    }, callback)
}

exports.playVideo = function(deviceName, videoUrl, callback) {

    // Homey.log(deviceName, devices)
    getDevice(deviceName, function(device) {
        getVideoInfo(videoUrl, function(err, media) {
            if (err) {
                Homey.error(err)
                callback && callback(err)
                return
            }
            //Homey.log(device)
            //Homey.log('media', media)
            //console.log(device);
            device.nokeepaliveplay(media.url, function(err) {
                //console.log(err)
                callback(null, true)
            })

            // intervals['i' + device.name] = setInterval(function() {
            //     device.playbackInfo(function(err, data) {
            //         console.log(device.state);
            //         if (device.state == 'stopped') {
            //             clearInterval(intervals['i' + device.name]);
            //             console.log('Keeping alive stopped!');
            //         };
            //     });
            // }, 30000)


        })
    }, callback)
}

function initDevice(device_data) {
    devices_data[device_data.id] = device_data
    console.log('Found device: ' + device_data.id)
}

function getDeviceByName(deviceName) {
    return devices.filter(function(device) {
        return device && device.name === deviceName
    })[0]
}

function getDevice(deviceName, success, error) {
    var device = getDeviceByName(deviceName)
    if (device) {
        success(device)
    } else if (error) {
        error(new Error('Device ' + deviceName + 'not found'))
    }
}

function getDeviceData(deviceName, success, error) {
    var device = devices_data[deviceName]
    if (device) {
        success(device)
    } else if (error) {
        error(new Error('Device ' + deviceName + 'not found'))
    }
}

// convert 1:15 to seconds (75)
function parseTime(time) {
    var seconds = 0
    time.split(':').reverse().forEach(function(part, i) {
        seconds += parseInt(part, 10) * Math.pow(60, i)
    })
    return seconds
}

function getVideoInfo(url, callback) {
    if (isYoutubeVideo(url)) {
        var options = {
            filter: function(format) {
                return format.type && format.type.indexOf('video/mp4') === 0
            }
        }
        getYTVideoInfo(url, options, function(err, info) {
            if (err) return callback(err)
                // Homey.log('YT info', info)
            callback(null, {
                url: info.url,
                cover: {
                    title: info.title,
                    url: info.iurlmaxres
                }
            })
        })
    } else {
        callback(null, {
            url: url
        })
    }
}

function isYoutubeVideo(url) {
    return /(?:youtu\.be)|(?:youtube\.com)/.test(url)
}

function getYTVideoInfo(url, options, callback) {
    ytdl.getInfo(url, function(err, info) {
        if (err) {
            callback(err)
            return
        }
        var format = ytdlUtil.chooseFormat(info.formats, options)
        if (format instanceof Error) {
            callback(format)
        } else {
            callback(null, format)
        }
    })
}
