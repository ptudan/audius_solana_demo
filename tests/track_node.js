const assert = require("assert");
const anchor = require('@project-serum/anchor');
const { SystemProgram } = anchor.web3;

describe('trackNode', () => {
  
  const provider = anchor.Provider.local();

  // Configure the client to use the local cluster.
  anchor.setProvider(provider);
  const trackNodeRootNode = anchor.web3.Keypair.generate();
  const trackCountAccount = anchor.web3.Keypair.generate();
  const TEST_TRACK_TITLE = "Firework";
  const CHILDREN_PER_NODE = 300;
  const TEST_TRACK_TITLE_UPDATED = "Fireworks";

  it("Initializes the track system", async () => {
    const trackNode = anchor.workspace.TrackNode;
    // Initialize a new track system, by initing the root node and the track counter.
    const tx = await trackNode.rpc.initialize(new anchor.BN("2430000000000"), {
      accounts: {
        trackNode: trackNodeRootNode.publicKey,
        trackCount: trackCountAccount.publicKey,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      },
      signers: [trackNodeRootNode, trackCountAccount],
    });
  });

  it("creates a new path to leaf", async () => {
    const trackNode = anchor.workspace.TrackNode;
    var parentTrackNode = await trackNode.account.trackNode.fetch(trackNodeRootNode.publicKey);
    var parentAccount = trackNodeRootNode;
    while(parentTrackNode.magnitude > 1) {
      const childAccount = anchor.web3.Keypair.generate();
      const tx = await trackNode.rpc.addChildAsNode({
        accounts: {
          trackNode: parentAccount.publicKey,
          childTrackNode: childAccount.publicKey,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [childAccount],
      });
      parentTrackNode = await trackNode.account.trackNode.fetch(parentAccount.publicKey);
      assert.ok((parentTrackNode.children[parentTrackNode.children.length -1]._bn).eq(childAccount.publicKey._bn));
      parentTrackNode = await trackNode.account.trackNode.fetch(childAccount.publicKey);
      parentAccount = childAccount;
    }
  });

  it("uploads a track", async () => {
    const trackNode = anchor.workspace.TrackNode;
    var parentTrackNode = await trackNode.account.trackNode.fetch(trackNodeRootNode.publicKey);
    var parentAccount = trackNodeRootNode;
    var trackCountAccountLoaded = await trackNode.account.trackCount.fetch(trackCountAccount.publicKey);
    var track_number = trackCountAccountLoaded.trackCount;
    while(parentTrackNode.magnitude > 1) {
      const childAccount = parentTrackNode.children[(track_number%(parentTrackNode.magnitude*CHILDREN_PER_NODE))/parentTrackNode.magnitude];
      parentAccount = childAccount;
      parentTrackNode = await trackNode.account.trackNode.fetch(childAccount);
    }

    const trackAccount = anchor.web3.Keypair.generate();

    const tx = await trackNode.rpc.addChildAsTrack(TEST_TRACK_TITLE, provider.wallet.publicKey, {
      accounts: {
        trackNode: parentAccount,
        track: trackAccount.publicKey,
        trackCount: trackCountAccount.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      },
      signers: [trackAccount],
    });
    parentTrackNode = await trackNode.account.trackNode.fetch(parentAccount);
    assert.ok((parentTrackNode.children[parentTrackNode.children.length - 1]._bn).eq(trackAccount.publicKey._bn));
    const trackAccountFinished = await trackNode.account.track.fetch(trackAccount.publicKey);
    assert.ok(trackAccountFinished.ipfsMusicCid === TEST_TRACK_TITLE);

  });

  it("gets a track", async() => {
    const trackNode = anchor.workspace.TrackNode;
    var parentTrackNode = await trackNode.account.trackNode.fetch(trackNodeRootNode.publicKey);
    var parentAccount = trackNodeRootNode;
    var trackNumber = 0;
    while(parentTrackNode.magnitude > 1) {
      const childAccount = parentTrackNode.children[(trackNumber%(parentTrackNode.magnitude*CHILDREN_PER_NODE))/parentTrackNode.magnitude];
      parentAccount = childAccount;
      parentTrackNode = await trackNode.account.trackNode.fetch(childAccount);
    }
    const trackAccountKey = parentTrackNode.children[(trackNumber%(parentTrackNode.magnitude*CHILDREN_PER_NODE))/parentTrackNode.magnitude];
    const trackAccount = await trackNode.account.track.fetch(trackAccountKey);
    assert.ok(trackAccount.ipfsMusicCid === TEST_TRACK_TITLE);
  });

  it("updates a track", async() => {
    const trackNode = anchor.workspace.TrackNode;
    var parentTrackNode = await trackNode.account.trackNode.fetch(trackNodeRootNode.publicKey);
    var parentAccount = trackNodeRootNode;
    var trackNumber = 0;
    while(parentTrackNode.magnitude > 1) {
      const childAccount = parentTrackNode.children[(trackNumber%(parentTrackNode.magnitude*CHILDREN_PER_NODE))/parentTrackNode.magnitude];
      parentAccount = childAccount;
      parentTrackNode = await trackNode.account.trackNode.fetch(childAccount);
    }
    const trackAccountKey = parentTrackNode.children[(trackNumber%(parentTrackNode.magnitude*CHILDREN_PER_NODE))/parentTrackNode.magnitude];
    const tx = await trackNode.rpc.updateTrack(TEST_TRACK_TITLE_UPDATED, {
      accounts : {
        track: trackAccountKey,
        owner: provider.wallet.publicKey
      },
    });
    const trackAccount = await trackNode.account.track.fetch(trackAccountKey);
    assert.ok(trackAccount.ipfsMusicCid === TEST_TRACK_TITLE_UPDATED);
  });

});
