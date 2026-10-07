import userService from '../services/UserService.js';

class UserController {

    async getAll(req, res, next) {
        try {
            res.status(200).json(await userService.getAll());
        } catch (err) {
            next(err);
        }
    }

    async getMe(req, res, next) {
        try {
            res.status(200).json(await userService.getById(req.user.id));
        } catch (err) {
            next(err);
        }
    }

    async update(req, res, next) {
        try {
            res.status(200).json(await userService.update(req.user.id, req.params.id, req.body));
        } catch (err) {
            next(err);
        }
    }

    async unlock(req, res, next) {
        try {
            res.status(200).json(await userService.unlock(req.params.id));
        } catch (err) {
            next(err);
        }
    }

    async resetMfa(req, res, next) {
        try {
            res.status(200).json(await userService.resetMfa(req.params.id));
        } catch (err) {
            next(err);
        }
    }
}

export default new UserController();
