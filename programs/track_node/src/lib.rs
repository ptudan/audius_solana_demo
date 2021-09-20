use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

declare_id!("SWEETpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod track_node {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>, magnitude: u64) -> ProgramResult {
        let track_node = &mut ctx.accounts.track_node;
        let track_count = &mut ctx.accounts.track_count;
        // if track_node.children.len() > 0 || track_count.track_count > 0 {
        //     return Err(ErrorCode::AlreadyInitialized.into());
        // }
        track_node.magnitude = magnitude;
        track_node.children = Vec::with_capacity(300);
        track_count.track_count = 0;
        Ok(())
    }

    pub fn add_child_as_node(ctx: Context<AddNodeChild>) -> ProgramResult {
        let track_node = &mut ctx.accounts.track_node; // cur node
        let child_track_node = &mut ctx.accounts.child_track_node; // new track
        if track_node.magnitude == 1 {
            return Err(ErrorCode::NotInnerNode.into());
        } else if track_node.children.len() >= 300 {
            return Err(ErrorCode::AlreadyFullNode.into());
        }
        track_node.children.push(child_track_node.key());
        child_track_node.magnitude = track_node.magnitude / 300;
        child_track_node.children = Vec::with_capacity(300);
        Ok(())
    }

    pub fn add_child_as_track(ctx: Context<AddTrackChild>, ipfs_music_cid: String, owner: Pubkey) -> ProgramResult {
        let track_node = &mut ctx.accounts.track_node; // cur node
        let track = &mut ctx.accounts.track; // new track
        let track_count = &mut ctx.accounts.track_count;
        if track_node.magnitude != 1 {
            return Err(ErrorCode::NotExternalNode.into());
        } else if track_node.children.len() >= 300 {
            return Err(ErrorCode::AlreadyFullNode.into());
        }
        track_node.children.push(track.key());
        track.ipfs_music_cid = ipfs_music_cid;
        track.track_id = track_count.track_count;
        track_count.track_count = track_count.track_count + 1;
        track.owner = owner;
        Ok(())

    }

    pub fn update_track(ctx: Context<UpdateTrack>, new_ipfs_music_cid: String) -> ProgramResult {
        let track = &mut ctx.accounts.track;
        track.ipfs_music_cid = new_ipfs_music_cid;
        Ok(())
    }

    pub fn set_data(ctx: Context<SetData>, data: u64) -> ProgramResult {
        let track_node = &mut ctx.accounts.track_node;
        track_node.data = data;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8 + 9600 + 8)]
    pub track_node: Account<'info, TrackNode>,
    #[account(init, payer = user, space = 8 + 8)]
    pub track_count: Account<'info, TrackCount>,
    #[account(signer)]
    pub user: AccountInfo<'info>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct AddTrackChild<'info> {
    #[account(mut)]
    pub track_node: Account<'info, TrackNode>,
    #[account(init, payer = owner, space = 8 + 128 + 8 + 32)]
    pub track: Account<'info, Track>,
    #[account(mut)]
    pub track_count: Account<'info, TrackCount>,
    #[account(signer)]
    pub owner: AccountInfo<'info>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct AddNodeChild<'info> {
    #[account(mut)]
    pub track_node: Account<'info, TrackNode>,
    #[account(init, payer = user, space = 8 + 8 + 9600 + 8)]
    pub child_track_node: Account<'info, TrackNode>,
    #[account(signer)]
    pub user: AccountInfo<'info>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct SetData<'info> {
    #[account(mut)]
    pub track_node: Account<'info, TrackNode>,
}

#[account]
pub struct TrackCount {
    pub track_count: u64
}

#[account]
pub struct TrackNode {
    pub data: u64,
    pub children: Vec<Pubkey>,
    pub magnitude: u64,
}

#[derive(Accounts)]
pub struct UpdateTrack<'info> {
    #[account(mut, has_one = owner)]
    pub track: Account<'info, Track>,
    #[account(signer)]
    pub owner: AccountInfo<'info>,
}

#[account]
pub struct Track {
    pub ipfs_music_cid: String,
    pub track_id: u64,
    pub owner: Pubkey
}

#[error]
pub enum ErrorCode {
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,
    #[msg("Node is full!")]
    AlreadyFullNode,
    #[msg("This node is meant to hold tracks as leaves, not be a middle node.")]
    NotInnerNode,
    #[msg("This node is meant to be an inner node holding other nodes, not tracks.")]
    NotExternalNode,
    #[msg("This node has already been initialized.")]
    AlreadyInitialized,
}
