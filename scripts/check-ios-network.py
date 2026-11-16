"""Check the effective ATS policy in the source or packaged app plist."""
import pathlib
import plistlib
import sys

path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'ios/LxMusicMobile/Info.plist')
policy = plistlib.loads(path.read_bytes()).get('NSAppTransportSecurity', {})
assert policy.get('NSAllowsArbitraryLoads') is True, 'User-configured HTTP sources and audio must be allowed'
# On iOS 10+, the presence of any of these keys overrides arbitrary loads to NO.
for key in ('NSAllowsLocalNetworking', 'NSAllowsArbitraryLoadsForMedia', 'NSAllowsArbitraryLoadsInWebContent'):
    assert key not in policy, f'{key} disables the intended HTTP policy, even if set to false'
print(f'HTTP source and audio policy verified: {path}')
