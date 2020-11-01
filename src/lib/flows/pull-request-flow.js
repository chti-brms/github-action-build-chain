const {
  checkoutDefinitionTree,
  getFinalDefinitionFilePath
} = require("./common/build-chain-flow-helper");
const { executeBuild } = require("./common/common-helper");
const {
  getTreeForProject,
  parentChainFromNode
} = require("@kie/build-chain-configuration-reader");
const { printCheckoutInformation } = require("../summary");
const { logger } = require("../common");
const core = require("@actions/core");
const {
  archiveArtifacts
} = require("../artifacts/build-chain-flow-archive-artifact-helper");

async function start(context, isArchiveArtifacts = true) {
  core.startGroup(
    `[Pull Request Flow] Checking out ${context.config.github.groupProject} and its dependencies`
  );
  const definitionFile = await getFinalDefinitionFilePath(
    context,
    context.config.github.inputs.definitionFile
  );
  const definitionTree = await getTreeForProject(
    definitionFile,
    context.config.github.repository
  );
  const nodeChain = await parentChainFromNode(definitionTree);

  logger.info(
    `Tree for project ${
      context.config.github.inputs.startingProject
    } loaded from ${definitionFile}. Dependencies: ${nodeChain.map(
      node => "\n" + node.project
    )}`
  );
  const checkoutInfo = await checkoutDefinitionTree(
    context,
    [...nodeChain].reverse()
  );
  core.endGroup();

  core.startGroup(`[Pull Request Flow] Checkout Summary...`);
  printCheckoutInformation(checkoutInfo);
  core.endGroup();

  const executionResult = await executeBuild(
    context.config.rootFolder,
    nodeChain,
    context.config.github.repository
  )
    .then(() => true)
    .catch(e => e);

  if (isArchiveArtifacts) {
    core.startGroup(`[Pull Request Flow] Archiving artifacts...`);
    await archiveArtifacts(
      nodeChain.find(node => node.project === context.config.github.repository),
      nodeChain,
      executionResult === true ? ["success", "always"] : ["failure", "always"]
    );
    core.endGroup();
  } else {
    logger.info("Archive artifact won't be executed");
  }

  if (executionResult !== true) {
    logger.error(executionResult);
    throw new Error(
      `Command executions have failed, please review latest execution ${executionResult}`
    );
  }
}

module.exports = {
  start
};