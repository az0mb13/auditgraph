// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IUniswapRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

contract LiquidityPool {
    mapping(address => uint256) public balances;
    mapping(address => uint256) public lastStakeTime;
    IUniswapRouter public router;
    address public rewardToken;
    address public stakingToken;
    uint256 public totalStaked;
    bool private locked;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event Compounded(address indexed user, uint256 amount);

    modifier noReentrant() {
        require(!locked, "Reentrant");
        locked = true;
        _;
        locked = false;
    }

    constructor(address _router, address _rewardToken, address _stakingToken) {
        router = IUniswapRouter(_router);
        rewardToken = _rewardToken;
        stakingToken = _stakingToken;
    }

    function deposit(uint256 amount) external {
        _updateReward(msg.sender);
        
        // Transfer tokens from user
        (bool success, bytes memory data) = stakingToken.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(this), amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Transfer failed");

        balances[msg.sender] += amount;
        totalStaked += amount;
        lastStakeTime[msg.sender] = block.timestamp;

        _stake(amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) external noReentrant {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        _updateReward(msg.sender);
        
        balances[msg.sender] -= amount;
        totalStaked -= amount;

        _unstake(amount);
        
        // Transfer tokens back to user
        (bool success, bytes memory data) = stakingToken.call(
            abi.encodeWithSignature("transfer(address,uint256)", msg.sender, amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Transfer failed");
        
        emit Withdrawn(msg.sender, amount);
    }

    function compound() external {
        uint256 reward = _calculateReward(msg.sender);
        require(reward > 0, "No rewards");

        // Swap reward token for staking token
        uint256 received = _swapRewardToStakingToken(reward);
        
        // Re-stake the received amount
        balances[msg.sender] += received;
        totalStaked += received;
        
        _stake(received);
        emit Compounded(msg.sender, received);
        
        // Reset reward timer
        lastStakeTime[msg.sender] = block.timestamp;
    }

    function _stake(uint256 amount) internal {
        // Apply tiered bonus based on stake size
        if (amount > 1000 ether) {
            _applyBonus(msg.sender, 5); // 5% bonus tracking
        } else if (amount > 100 ether) {
            _applyBonus(msg.sender, 2); // 2% bonus tracking
        }
    }

    function _unstake(uint256 amount) internal {
        // Check for early unstake penalty
        if (block.timestamp < lastStakeTime[msg.sender] + 7 days) {
            uint256 penalty = (amount * 10) / 100; // 10% penalty
            // Burn penalty or send to treasury (omitted)
        }
    }

    function _updateReward(address user) internal {
        uint256 reward = _calculateReward(user);
        if (reward > 0) {
            // Mint or transfer reward
            (bool success, ) = rewardToken.call(
                abi.encodeWithSignature("transfer(address,uint256)", user, reward)
            );
            require(success, "Reward transfer failed");
            emit RewardPaid(user, reward);
        }
    }

    function _calculateReward(address user) internal view returns (uint256) {
        uint256 timeDelta = block.timestamp - lastStakeTime[user];
        uint256 rate = 1e15; // Mock rate per second
        return (balances[user] * timeDelta * rate) / 1e18;
    }

    function _applyBonus(address user, uint256 percent) internal {
        // Logic to track user bonuses (simplified)
        // e.g. set a mapping userBonus[user] = percent;
    }

    function _swapRewardToStakingToken(uint256 amount) internal returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = rewardToken;
        path[1] = stakingToken;
        
        // Approve router
        (bool approved, ) = rewardToken.call(
            abi.encodeWithSignature("approve(address,uint256)", address(router), amount)
        );
        require(approved, "Approve failed");

        uint256[] memory amounts = router.swapExactTokensForTokens(
            amount,
            0, // slippage ignored for demo
            path,
            address(this),
            block.timestamp
        );
        
        return amounts[1];
    }
    
    function emergencyExit() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");
        
        _unstake(amount);
        balances[msg.sender] = 0;
        totalStaked -= amount;
        
        (bool success, ) = stakingToken.call(
            abi.encodeWithSignature("transfer(address,uint256)", msg.sender, amount)
        );
        require(success, "Transfer failed");
        
        emit Withdrawn(msg.sender, amount);
    }
}
