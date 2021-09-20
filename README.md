## Audius Solana Demo Integration

This repo demonstrates a basic track metadata uploading program.  Users can submit IPFS Ids representing audio files on IPFS, and associate them with a track_id in the metadata system.

## Installation Instructions

Install all necessary anchor dependencies: https://project-serum.github.io/anchor/getting-started/installation.html

(ensure you use the same anchor version as this project, v0.15.0.  Anchor frequently introduces breaking changes are releases new major versions at an almost weekly cadence).

## Running Instructions
```anchor build && anchor test``` in the track_node/ directory will compile and run the tests against a local solana validator.  Ensure you DO NOT have the solana-test-validator running as ```anchor test``` will spin up its own.

To test the frontend, first run a test validator via ```solana-test-validator``` in another terminal tab/mux/screen.  Then run ```anchor build```, and the associated solana deploy command.  Finally, navigate to app/app and run ```yarn start```.

You will need phantom/sollet set up on your browser, with sol airdropped from your local network ```solana airdrop <SOL>```.  As of now, there are some bugs remaining on the frontend.  But the login and init should work.

## Design Motivations

This system works on a tree structure.  Each node in the tree is either internal (its children are other nodes), or external (its children are tracks).  This gets around the account size limit and lack of hashing on solana, and makes for an infinitely sized data structure.

To traverse the tree to either get a track or upload a track, use the following algorithm:

	If the magnitude of a node is > 1, this means it holds other nodes (interal node). So we need to find the next node.
	Else, we know the children are tracks (and slots for tracks).

	How to pick the slot?
	(trackNumber%(parentTrackNode.magnitude*CHILDREN_PER_NODE))/parentTrackNode.magnitude
	
	notice that "magnitude * CHILDREN_PER_NODE" could also be considered the "Grandparent's magnitude".

	Example:
	Here, CHILDREN_PER_NODE = 10, for clarity.  In actuality the value is 300 for a flatter tree.
	
	TrackNumber: 556
	Root Node has a magnitude of 1000 (ie each of its subtrees has 1000 tracks)
	(556%(1000*10)) = 556, 556/1000 = 0.  Traverse to child 0.

	Current Node has a magnitude of 100 
	(556%(100*10)) = 556, 556/100 = 5.  Traverse to child 5.

	Current Node has a magnitude of 10
	(556%(10*10)) = 56, 56/10 = 5.  Traverse to child 5.

	Current Node has a magnitude of 1.
	556%10 = 6, 6/1 = 6.  Traverse/insert at child 6.

Motivations for this data structure:
- Infinite storage.  Should a tree ever fill, it can be moved to the leftmost child of a new root.
- Quick lookup times.  With 300 children per node, the depth would be 4 or less for up to 8.1 billion tracks.
- Independent track accounts can be accessed/edited without any blocking write cycles.

Current Features:
- Only those who upload an account can edit the ipfs id.  Check the accounts required to be signers in the idl.

Future Extensions:
- Assuming multiple ipfs_ids are associated with a given song, create an account to group the individual pieces.  This can include album art.  Any other monotonic data should likely have its own tree to minimize duplicate storage (for example, if multiple songs shared the same art).

Current Bugs
- Frontend has program errors due to clash of programId/declared Id.


