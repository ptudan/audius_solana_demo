import solana_logo from './solana.gif';
import audius_logo from './audius.gif';
import './App.css';
import { useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  Program, Provider, web3, BN
} from '@project-serum/anchor';
import track_node from './track_node.json';

import { getPhantomWallet, getSolletWallet } from '@solana/wallet-adapter-wallets';
import { useWallet, WalletProvider, ConnectionProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const CHILDREN_PER_NODE = 300;
const wallets = [
  /* view list of available wallets at https://github.com/solana-labs/wallet-adapter#wallets */
  getPhantomWallet(),
  getSolletWallet()
]

const { SystemProgram, Keypair } = web3;
/* create an account  */
const trackNodeRootAccount = Keypair.generate();
const trackCountAccount = Keypair.generate();
const opts = {
  preflightCommitment: "processed"
}
const programID = new PublicKey("21Yj8ih8ZZVEHmh7FC4FUwXLuqu3RmrJXpdVYJMdi8zn");


function App() {
  const [output, setOutput] = useState(null);
  const [trackCount, setTrackCount] = useState(null);
  const wallet = useWallet();
  
  // this.handleUploadChange = this.handleUploadChange.bind(this);
  // this.handleUploadSubmit = this.handleUploadSubmit.bind(this);

  async function getProvider() {
    /* create the provider and return it to the caller */
    /* network set to local network for now */
    const network = "http://127.0.0.1:8899";
    const connection = new Connection(network, opts.preflightCommitment);
    const provider = new Provider(
      connection, wallet, opts.preflightCommitment,
    );
    return provider;
  }

  async function initiateSystem() {    
    const provider = await getProvider()
    console.log(provider);
    /* create the program interface combining the idl, program ID, and provider */
    const program = new Program(track_node, programID, provider);
    var tx = 0;
    try {
      /* interact with the program via rpc */
      const rootMagntiude = new BN("2430000000000");
      console.log(rootMagntiude);
      tx = await program.rpc.initialize(rootMagntiude, {
        accounts: {
          trackNode: trackNodeRootAccount.publicKey,
          trackCount: trackCountAccount.publicKey,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId, 
        },
        signers: [trackNodeRootAccount, trackCountAccount]
      });

      const account = await program.account.trackNode.fetch(trackNodeRootAccount.publicKey);
      const tc = await getCurrentTrackCount();
      setTrackCount(tc);
    } catch (err) {
      console.log("Transaction error: ", err);
    }
  }

  /**
   * Call this function on a node to add new nodes all the way to an external node.
   * 
   * If called on node A:
   *      A            A
   *    1     ->    1     2
   *   x y         x y   a 
   * @param {trackNode publicKey} parentNode 
   */
  async function addPathToLeaf(parentNode) {
    const provider = await getProvider()
    const program = new Program(track_node, programID, provider);
    var parentAccount = parentNode;
    while(parentNode.magnitude > 1) {
      const childAccount = Keypair.generate();
      const tx = await program.rpc.addChildAsNode({
        accounts: {
          trackNode: parentAccount.publicKey,
          childTrackNode: childAccount.publicKey,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [childAccount],
      });
      parentNode = await program.account.trackNode.fetch(childAccount.publicKey);
      parentAccount = childAccount;
    }
  }

  /**
   * Uploads a ipfs cid into the system.  As solana programs do not have return values, there isn't a way to return
   * the trackId that is used.
   * 
   * TODO: corner case when the external node fills up with tracks due to parallel transactions.
   * 
   * TODO: "metadata" account program per user address.  This program can hold values like track_ids owned etc.  Users can check this
   * instead of the return value from this function.
   * 
   * @param {IpfsCid to associate with the new track} ipfsMusicCid 
   */
  async function uploadTrack(ipfsMusicCid) {
    const provider = await getProvider()
    const program = new Program(track_node, programID, provider);
    var parentTrackNode = await program.account.trackNode.fetch(trackNodeRootAccount.publicKey);
    var parentAccount = trackNodeRootAccount;
    var trackCountAccountLoaded = await program.account.trackCount.fetch(trackCountAccount.publicKey);
    var track_number = trackCountAccountLoaded.trackCount;
    while(parentTrackNode.magnitude > 1) {
      const childAccount = parentTrackNode.children[(track_number%(parentTrackNode.magnitude*CHILDREN_PER_NODE))/parentTrackNode.magnitude];
      parentAccount = childAccount;
      parentTrackNode = await program.account.trackNode.fetch(childAccount);
    }

    const trackAccount = Keypair.generate();
    const tx = await program.rpc.addChildAsTrack(ipfsMusicCid, provider.wallet.publicKey, {
      accounts: {
        trackNode: parentAccount,
        track: trackAccount.publicKey,
        trackCount: trackCountAccount.publicKey,
        owner: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      },
      signers: [trackAccount],
    });
    const tc = await getCurrentTrackCount();
    setTrackCount(tc);
  }

  async function getTrack(trackNumber) {
    const provider = await getProvider()
    const program = new Program(track_node, programID, provider);
    var parentTrackNode = await program.account.trackNode.fetch(trackNodeRootAccount.publicKey);
    var parentAccount = trackNodeRootAccount;
    while(parentTrackNode.magnitude > 1) {
      const childAccount = parentTrackNode.children[(trackNumber%(parentTrackNode.magnitude*CHILDREN_PER_NODE))/parentTrackNode.magnitude];
      parentAccount = childAccount;
      parentTrackNode = await program.account.trackNode.fetch(childAccount);
    }
    const trackAccountKey = parentTrackNode.children[(trackNumber%(parentTrackNode.magnitude*CHILDREN_PER_NODE))/parentTrackNode.magnitude];
    const trackAccount = await program.account.track.fetch(trackAccountKey);
    return trackAccount;
  }

  /**
   * Calls track count account and checks current value.
   * @returns current track count
   */
  async function getCurrentTrackCount() {
      const provider = await getProvider()
      /* create the program interface combining the idl, program ID, and provider */
      const program = new Program(track_node, programID, provider);
      var trackCountAccountLoaded = await program.account.trackCount.fetch(trackCountAccount.publicKey);
      var track_number = trackCountAccountLoaded.trackCount;
      return track_number.toString();
  }

  function UploadForm() {
    const [IpfsCid, setIpfsCid] = useState("");
    const handleSubmit = (evt) => {
      evt.preventDefault();
      alert(`Submitting Name ${IpfsCid}`)
      uploadTrack(IpfsCid);
    }
    return (
      <form onSubmit={handleSubmit}>
        <label>
          Upload a track!  Ipfs Cid:
          <input type="text" value={IpfsCid} name="upload" onChange={e => setIpfsCid(e.target.value)} />
        </label>
        <input type="submit" value="Upload" />
      </form>
    );
  }

  function GetForm() {
    const [TrackNumber, setTrackNumber] = useState("");
    const handleSubmit = (evt) => {
      evt.preventDefault();
      alert(`Getting Name ${TrackNumber}`);
      setOutput(getTrack(TrackNumber));
    }
    return (
      <form onSubmit={handleSubmit}>
        <label>
          Get a track!  Track Number:
          <input type="number " value={TrackNumber} name="get" onChange={e => setTrackNumber(e.target.value)} />
        </label>
        <input type="submit" value="Get" />
      </form>
    );
  }

  const up = UploadForm();
  const get = GetForm();
  if (!wallet.connected) {
    /* If the user's wallet is not connected, display connect wallet button. */
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop:'100px' }}>
        <WalletMultiButton />
      </div>
    )
  }
  return (
    <div className="App">
      <header className="App-header">
        <div style={{display:"flex", flexDirection:"row"}}>
          <img src={audius_logo} className="App-logo" alt="logo" />
          <div style={{width:"10  vw"}}></div>
          <img src={solana_logo} className="App-logo" alt="logo" />
        </div>
        <br></br>
        <p>
          Audius and Solana have begun to merge!
        </p>
      </header>
      <div style={{backgroundColor:"#e8e3c3", height:"40vh"}}>
        <button onClick={() => {initiateSystem()}}>Initiate System</button>
        <span>Current Track Count: {trackCount}</span>
        {up}
        {get}
        <br></br>
        <span>{output}</span>
      </div>
    </div>
  );
}


/* wallet configuration as specified here: https://github.com/solana-labs/wallet-adapter#setup */
const AppWithProvider = () => (
  <ConnectionProvider endpoint="http://127.0.0.1:8899">
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
        <App />
      </WalletModalProvider>
    </WalletProvider>
  </ConnectionProvider>
)

export default AppWithProvider;

  // /**
  //  * Scans tree to see if the nodes are full.
  //  * @param {TrackNumber to add} nextTrackNumber 
  //  * @returns boolean whether there is an available slot for a track without creating new nodes.
  //  */
  //  async function isOpenTrackSlot(nextTrackNumber) {
  //   const provider = await getProvider()
  //   /* create the program interface combining the idl, program ID, and provider */
  //   const program = new Program(track_node, programID, provider);
  //   var parentTrackNode = await program.account.trackNode.fetch(trackNodeRootAccount.publicKey);
  //   var parentAccount = trackNodeRootAccount;
  //   while(parentTrackNode.magnitude > 1) {
  //     const nextInd = (nextTrackNumber%(parentTrackNode.magnitude*CHILDREN_PER_NODE))/parentTrackNode.magnitude;
  //     if (nextInd >= parentTrackNode.children.length) {
  //       return false;
  //     }
  //     const childAccount = parentTrackNode.children[nextInd];
  //     parentAccount = childAccount;
  //     parentTrackNode = await program.account.trackNode.fetch(childAccount);
  //   }
  //   return parentTrackNode.children.length < CHILDREN_PER_NODE;

  // }

  // /**
  //  * 
  //  */
  // async function addNextNode() {
  //   const provider = await getProvider()
  //   /* create the program interface combining the idl, program ID, and provider */
  //   const program = new Program(track_node, programID, provider);
  //   var parentTrackNode = await program.account.trackNode.fetch(trackNodeRootNode.publicKey);
  //   var parentAccount = trackNodeRootNode;
  //   st = []
  //   while(parentTrackNode.magnitude > 1) {
  //     const nextInd = parentTrackNode.children.length - 1;
  //     if (nextInd >= parentTrackNode.children.length) {
  //       return false;
  //     }
  //     const childAccount = parentTrackNode.children[nextInd];
  //     parentAccount = childAccount;
  //     parentTrackNode = await trackNode.account.trackNode.fetch(childAccount);
  //   }
  // }
