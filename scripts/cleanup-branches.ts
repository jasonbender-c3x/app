import { listBranches, deleteBranch, getDefaultBranch, listUserRepos } from '../server/integrations/github';

async function main() {
  const owner = 'jasonbender-c3x';
  const repo = 'app';
  
  console.log(`\n=== Branch Cleanup for ${owner}/${repo} ===\n`);
  
  try {
    const defaultBranch = await getDefaultBranch(owner, repo);
    console.log(`Default branch: ${defaultBranch}\n`);
    
    const branches = await listBranches(owner, repo);
    console.log(`Found ${branches.length} branches:\n`);
    
    for (const branch of branches) {
      const isDefault = branch.name === defaultBranch;
      const status = isDefault ? ' (DEFAULT - will keep)' : branch.protected ? ' (PROTECTED)' : '';
      console.log(`  - ${branch.name}${status}`);
    }
    
    const branchesToDelete = branches.filter(b => 
      b.name !== defaultBranch && !b.protected
    );
    
    if (branchesToDelete.length === 0) {
      console.log('\nNo branches to delete. Only the default branch exists.');
      return;
    }
    
    console.log(`\n\nWill delete ${branchesToDelete.length} non-default branches:`);
    for (const branch of branchesToDelete) {
      console.log(`  - ${branch.name}`);
    }
    
    console.log('\nDeleting branches...\n');
    
    for (const branch of branchesToDelete) {
      try {
        await deleteBranch(owner, repo, branch.name);
        console.log(`  ✓ Deleted: ${branch.name}`);
      } catch (err: any) {
        console.log(`  ✗ Failed to delete ${branch.name}: ${err.message}`);
      }
    }
    
    console.log('\n=== Cleanup Complete ===\n');
    
    const remainingBranches = await listBranches(owner, repo);
    console.log(`Remaining branches: ${remainingBranches.map(b => b.name).join(', ')}`);
    
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

main();
