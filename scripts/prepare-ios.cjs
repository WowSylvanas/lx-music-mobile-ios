const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const copy = (from, to) => fs.copyFileSync(path.join(root, from), path.join(root, to))
copy('android/app/src/main/assets/script/user-api-preload.js', 'ios/Port/user-api-preload.js')
copy('src/resources/fonts/icomoon.ttf', 'ios/Port/icomoon.ttf')

// Repair the upstream iOS template without changing the Android project.
const projectFile = path.join(root, 'ios/LxMusicMobile.xcodeproj/project.pbxproj')
let project = fs.readFileSync(projectFile, 'utf8')
project = project.replaceAll('IPHONEOS_DEPLOYMENT_TARGET = 13.4;', 'IPHONEOS_DEPLOYMENT_TARGET = 15.0;')
project = project.replaceAll('"org.reactjs.native.example.$(PRODUCT_NAME:rfc1034identifier)"', 'com.wowsylvanas.lxmusic.ios')
fs.writeFileSync(projectFile, project)

// The Android-oriented upstream fork leaves bridge methods on a background
// queue while AVPlayer end/queue callbacks run on main. Serialize both sides.
const playerFile = path.join(root, 'node_modules/react-native-track-player/ios/RNTrackPlayer/RNTrackPlayer.swift')
let player = fs.readFileSync(playerFile, 'utf8').replaceAll('\r\n', '\n')
if (!player.includes('// LX iOS: serialize player methods')) {
  const declaration = 'public class RNTrackPlayer: RCTEventEmitter {'
  if (!player.includes(declaration)) throw new Error('TrackPlayer class changed; review the iOS queue patch.')
  player = player.replace(declaration, declaration + `

    // LX iOS: serialize player methods with AVPlayer delegate callbacks.
    @objc public override var methodQueue: DispatchQueue! {
        return DispatchQueue.main
    }
`)
  const access = 'if let nextIndex = nextIndex {\n            let track = player.items[nextIndex]'
  if (!player.includes(access)) throw new Error('TrackPlayer queue callback changed; review the iOS bounds patch.')
  player = player.replace(access, 'if let nextIndex = nextIndex, player.items.indices.contains(nextIndex) {\n            let track = player.items[nextIndex]')
}
fs.writeFileSync(playerFile, player)
console.log('Prepared LX Music iOS resources and project settings.')
